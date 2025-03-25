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

import { PublicKey } from "@solana/web3.js";

const PROTOCOL_FEE_RECIPIENT = new PublicKey("12e2F4DKkD3Lff6WPYsU7Xd76SHPEyN9T8XSsTJNF8oT")
const GLOBAL_CONFIG_SEED = 'global_config'
const LP_MINT_SEED = 'pool_lp_mint'
const POOL_SEED = 'pool'
export {
    PROTOCOL_FEE_RECIPIENT,
    GLOBAL_CONFIG_SEED,
    LP_MINT_SEED,
    POOL_SEED
}