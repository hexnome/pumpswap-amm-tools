import { clusterApiUrl, Connection, Keypair } from "@solana/web3.js";
import "dotenv/config";
import fs from "fs";

const endpoint =
  process.env.MAINNET_ENDPOINT || clusterApiUrl("mainnet-beta");
export const connection = new Connection(endpoint, "confirmed");

export const PUMPSWAP_ADDRESS = process.env.PUMPSWAP_ADDRESS || "";
export const walletKeypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync("./keypair.json", "utf-8"))),
  { skipValidation: true }
);