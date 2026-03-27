const path = require("node:path");

const DEFAULT_HOST = process.env.HOST || "127.0.0.1";
const DEFAULT_PORT = Number(process.env.PORT || 3000);
const APP_ROOT_DIR = path.join(__dirname, "..", "app");
const L0_DIR = path.join(APP_ROOT_DIR, "L0");
const L1_DIR = path.join(APP_ROOT_DIR, "L1");
const L2_DIR = path.join(APP_ROOT_DIR, "L2");
const APP_DIR = L0_DIR;
const ASSET_DIR = path.join(L0_DIR, "assets");
const API_DIR = path.join(__dirname, "api");

module.exports = {
  API_DIR,
  APP_ROOT_DIR,
  ASSET_DIR,
  APP_DIR,
  DEFAULT_HOST,
  DEFAULT_PORT,
  L0_DIR,
  L1_DIR,
  L2_DIR
};
