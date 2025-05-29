import { PublicKey } from "@solana/web3.js";
import * as spl from "@solana/spl-token";
import { connection } from "../../config";

export const getTokenProgramId = async (mint: PublicKey) => {
    try {
        // First check if it's a Token-2022 account
        try {
            const accountInfo = await connection.getAccountInfo(mint);
            if (accountInfo) {
                // Check the owner of the account
                if (accountInfo.owner.equals(spl.TOKEN_2022_PROGRAM_ID)) {
                    console.log(`Mint ${mint.toBase58()} is a Token-2022 token`);
                    return spl.TOKEN_2022_PROGRAM_ID;
                }
            }
        } catch (err: any) {
            // If there's an error, default to classic SPL Token
            console.log(`Error checking Token-2022 status: ${err.message}`);
        }

        // Default to classic SPL Token
        console.log(`Mint ${mint.toBase58()} is a classic SPL token`);
        return spl.TOKEN_PROGRAM_ID;
    } catch (error: any) {
        console.error(`Error determining token program ID: ${error.message}`);
        // Default to classic SPL Token
        return spl.TOKEN_PROGRAM_ID;
    }
}