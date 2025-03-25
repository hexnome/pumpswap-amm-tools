import { Connection, PublicKey, Transaction } from "@solana/web3.js";


export class PumpFunAMMSDK {
    public connection: Connection;

    constructor(connection: Connection) {
        this.connection = connection;
    }

    async getMintTokenPrograms(
        baseMint: PublicKey,
        quoteMint: PublicKey
    ) {
        let baseMintAccount = await this.connection.getAccountInfo(baseMint);
        if(baseMintAccount === null) {
            throw new Error(`baseMint=${baseMint} not found`);
        }
        let quoteMintAccount = await this.connection.getAccountInfo(quoteMint);
        if(quoteMintAccount === null) {
            throw new Error(`quoteMint=${quoteMint} not found`);
        }
        return [baseMintAccount.owner, quoteMintAccount.owner];
    }

}
