#!/usr/local/bin/node

var fs = require("fs");
var prettyjson = require("prettyjson");
var { Duplex } = require("stream");

var workingDir = __dirname;
var util = require(workingDir + "/ingest-util");
var neoUtil = require(workingDir + "/neo-util");

var args = process.argv.splice(2);

if (process.argv.length < 2) {
  console.log("Must specify what to ingest");
  console.log(process.argv);
  process.exit(1);
}

var DONEO = false;

if (args.length >= 3 && args[0] === '-n') {
  DONEO = true;
  args.shift();
}

var ingestorConfigKey = args[0];
var ingestorConfigFile = args[1];

console.log("~~~ INGESTOR ~~~");

var ingestorConfig = JSON.parse(fs.readFileSync(ingestorConfigFile));
console.log();
console.log("Config key:", ingestorConfigKey);
console.log();
console.log("Config file:");
console.log(prettyjson.render(ingestorConfig));
console.log();

if (!ingestorConfig.source) {
  console.log("No data source o_O");
  process.exit(1);
}

console.log("Data source:", ingestorConfig.source);

var writer = process.stdout;

if (DONEO) {
  writer = new Duplex({write: (data, encoding, c)=>{writer.push(data); c()}, read: ()=>{}});

  writer.on('data', data => {
    console.log(neoUtil.genCreateOrUpdate('n', ingestorConfig.label, ingestorConfig.id, JSON.parse(data)));
  });
}

if (ingestorConfig.source) {
  var ingestor = util.new(ingestorConfig.source, 'json');

  ingestor.pipe(writer);
}

if (ingestorConfig.datasets) {
  for (dataset in ingestorConfig.datasets) {
    var ingestor = util.new(dataset.source, 'json');

    ingestor.pipe(writer);
  }
}
