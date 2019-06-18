const fs = require("fs");
const prettyjson = require("prettyjson");

const util = require("../utils/ingest-util");
const { NeoUploader } = require("./neoUploader");
const { SqlUploader } = require("./sqlUploader");
const { UploadManager } = require("./uploader");
const workingDir = __dirname;

const neo4j = require("neo4j-driver").v1;
const neoConfig = require("../neo-config");
const sqlConfig = require("../sql-config");
var knex = require('knex')({
  client: 'mysql',
  connection: {
    host: sqlConfig.host,
    user: sqlConfig.user,
    password: sqlConfig.password,
    database: sqlConfig.database
  }
});

var args = process.argv.splice(2);

var DO_UPLOAD = false;
var DEBUG = false;

while (args.length && args[0][0] == '-') {
  var flag = args.shift();

  switch (flag) {
    case '-u':
      DO_UPLOAD = true;
      break;

    case '-d':
      DEBUG = true;
      break;

    default:
      console.log("Warning - Unknown option:", args[0]);
  }
}

if (process.argv.length < 2) {
  console.log("Must specify what to ingest");
  console.log(process.argv);
  process.exit(1);
}

var ingestorConfigKey = args[0];
var ingestorConfigFile = args[1];

var ingestorConfig = JSON.parse(fs.readFileSync(ingestorConfigFile));

if (DEBUG) {
  console.log("~~~ INGESTOR ~~~");
  console.log();
  console.log("Config key:", ingestorConfigKey);
  console.log();
  console.log("Config file:");
  console.log(prettyjson.render(ingestorConfig.name));
}
else {
  console.log("Ingesting:", ingestorConfigKey);
}

if (!ingestorConfig.enabled) {
  console.log("DATASET DISABLED");
  process.exit();
}

var neoDriver;
if (DO_UPLOAD) {
  neoDriver = neo4j.driver(
    neoConfig.host,
    neo4j.auth.basic(neoConfig.user, neoConfig.password),
    { disableLosslessIntegers: true }
  );
}

if (ingestorConfig.source) {
  var dataFilename = workingDir + '/../datasets/data.' + ingestorConfigKey + '.flat';

  if (DEBUG) {
    console.log();
    console.log("Data source:", ingestorConfig.source);
    console.log("Data Storage File:", dataFilename);
  }

  util.new(ingestorConfig.name, ingestorConfig.source, dataFilename, DEBUG)
  .then(ingestStream => {
    var uploader;

    if (DO_UPLOAD) {
      console.log("Uploading to MariaDB:", ingestorConfigKey);

      uploader = new SqlUploader(
        ingestorConfig.name,
        knex,
        sqlConfig.max_uploads,
        ingestorConfig.id,
        ingestorConfig.table,
        ingestorConfig.fields
      );
    }
    else {
      return ingestStream.pipe(process.stdout)
    }

    var uploadManager = new UploadManager(
      ingestStream, uploader
    );

    return uploadManager.init().then(() => {
      return uploadManager.uploadData();
    });
  })
  .catch(err => {
    console.log("ERRR:", err);
  })
  .done(() => {
    console.log("INGESTOR: Done Uploading");
    if (neoDriver) {
      console.log("Closing Neo");
      neoDriver.close();
    }
    if (knex) {
      console.log("Closing SQL");
      knex.destroy();
    }

    return result;

    console.log("DONE!");
  });
}

if (ingestorConfig.datasets) {
  if (DEBUG) {
    console.log();
    console.log("Datasets:", ingestorConfig.datasets);
  }

  var ingestorPromises = ingestorConfig.datasets.map(dataset => {
    var dataFilename = workingDir + '/../datasets/data.' + ingestorConfigKey + '.' + dataset.key + '.flat';

    return util.new(dataset.name, dataset.source, dataFilename, DEBUG)
    .then(ingestStream => {
      var uploader;

      if (DO_UPLOAD) {
        console.log("Uploading to MariaDB:", ingestorConfigKey, dataset.key);

        uploader = new SqlUploader(
          dataset.name,
          knex, sqlConfig.max_uploads,
          dataset.id ? dataset.id : ingestorConfig.id,
          dataset.table, dataset.fields
        );
      }
      else {
        return ingestStream.pipe(process.stdout)
      }

      var uploadManager = new UploadManager(
        ingestStream, uploader
      );

      return uploadManager.init().then(() => {
        return uploadManager.uploadData();
      });
    });
  });

  Promise.all(ingestorPromises)
  .then(result => {
    console.log("DONE!");
    if (neoDriver) {
      console.log("Closing Neo");
      neoDriver.close();
    }
    if (knex) {
      console.log("Closing SQL");
      knex.destroy();
    }

    return result;
  })
  .catch(err => {
    console.log("ERRR:", err);
  });
}
