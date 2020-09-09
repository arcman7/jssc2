const path = require('path') //eslint-disable-line
const fs = require('fs') //eslint-disable-line

function Exists(dir_or_file_path) {
  return fs.existsSync(dir_or_file_path)
}

function IsDirectory(dirpath) {
  return fs.existsSync(dirpath) && fs.lstatSync(dirpath).isDirectory()
}

function ListDir(dirpath) {
  return fs.readdirSync(dirpath)
}

function MakeDirs(dirpath) {
  if (!fs.existsSync(dirpath)) {
    fs.mkdirSync(dirpath);
  }
  return true
}

module.exports = {
  Exists,
  IsDirectory,
  ListDir,
  MakeDirs,
  Open: fs.readFileSync,
  /*
  NODE FILE OPEN NOTES:

  var fs = require('fs');
  var path = process.cwd();
  var buffer = fs.readFileSync(path + "\\text.txt");
  console.log(buffer.toString());
  */
}
