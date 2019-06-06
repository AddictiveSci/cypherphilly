const Promise = require('promise');
const openLineByLine = require("readline").createInterface;

exports.UploadManager = class UploaderManager {

  constructor(input, uploader) {
    this.lineByLine = openLineByLine({
      input: input
    });
    this.uploader = uploader;
    this.finishedData = false;

    this.maxUploads = uploader.maxUploads ? uploader.maxUploads : 5;
  }

  init() {
    return this.uploader.init();
  }

  uploadData() {
    var resolve, reject;
    var retPromise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    var currentUploads = 0;

    this.lineByLine.on('close', () => {
      console.log("FINISHED INPUT");
      this.finishedData = true;
    });

    this.lineByLine.on('line', line => {
      currentUploads += 1;
      if (currentUploads >= this.maxUploads) {
        this.lineByLine.pause();
      }

      this.uploader.upload(JSON.parse(line))
      .then(() => {
        currentUploads -= 1;

        if (this.finishedData && currentUploads == 0) {
          console.log("FINISHED UPLOAD");
          this.uploader.close();
          resolve(true);
        }
        else {
          this.lineByLine.resume();
        }
      }).catch(reject);
    });

    return retPromise;
  }

}
