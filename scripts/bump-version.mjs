import fs from "node:fs";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf-8"));

const now = new Date();
const year = String(now.getFullYear()).slice(-2);
const month = String(now.getMonth() + 1).padStart(2, "0");

const [oldYear, oldMonth, oldPatch] = pkg.version.split(".");

let patch = 1;

if (oldYear === year && oldMonth === month) {
  patch = parseInt(oldPatch, 10) + 1;
}

const newVersion = `${year}.${month}.${patch}`;

pkg.version = newVersion;

fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");

console.log(newVersion);
