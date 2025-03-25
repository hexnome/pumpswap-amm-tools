import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { clusterApiUrl, Connection, Keypair, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import idl from "../idl/pump-swap.json";
import type { PumpSwapIDL } from "../idl/pump-swap";
import { GLOBAL_CONFIG_SEED, LP_MINT_SEED, POOL_SEED, PROTOCOL_FEE_RECIPIENT } from "../config/constants";
import { CreatePoolType, DepositType, TradeType, WithdrawType } from "./type";

class PumpSwapSDK {
    private program: Program<PumpSwapIDL>;

    /**
     * 
     * @param cluster "mainnet" | "devnet"
     * @param commitment "processed" | "confirmed" | "finalized"
     * @param customRPC string 
     */
    constructor(
        cluster: "mainnet" | "devnet",
        commitment: "processed" | "confirmed" | "finalized",
        customRPC: string
    ) {
        const wallet = new NodeWallet(Keypair.generate())
        const url = cluster == "mainnet" ? clusterApiUrl("mainnet-beta") : clusterApiUrl("devnet")
        let connection: Connection;
        try {
            connection = new Connection(customRPC, { commitment: commitment })
        } catch (error) {
            connection = new Connection(url, { commitment: commitment })
        }
        const provider = new AnchorProvider(connection, wallet, { commitment: commitment });
        const program = new Program(idl as PumpSwapIDL, provider);
        this.program = program;
    }

    /**
     * 
     * @param lpFeeBasisPoints BN
     * @param protocolFeeBasisPoints BN
     * @param protocolFeeRecipients Array<PublicKey>
     * @returns Promise<TransactionInstruction>
     */
    getCreateConfigInstruction = async (
        lpFeeBasisPoints: BN,
        protocolFeeBasisPoints: BN,
        protocolFeeRecipients: Array<PublicKey>
    ): Promise<TransactionInstruction> => {
        const ix = await this.program.methods
            .createConfig(
                lpFeeBasisPoints,
                protocolFeeBasisPoints,
                protocolFeeRecipients
            )
            .accounts({
                program: this.program.programId
            })
            .instruction()
        return ix
    }

    /**
     * 
     * @param baseAmountOut BN
     * @param maxQuoteAmountIn BN
     * @param tradeParam TradeType
     * @returns Promise<TransactionInstruction>
     */
    getBuyInstruction = async (
        baseAmountOut: BN,
        maxQuoteAmountIn: BN,
        tradeParam: TradeType
    ): Promise<TransactionInstruction> => {
        const {
            baseMint,
            baseTokenProgram,
            pool,
            quoteMint,
            quoteTokenProgram,
            user
        } = tradeParam
        const [globalConfig] = PublicKey.findProgramAddressSync([Buffer.from(GLOBAL_CONFIG_SEED)], this.program.programId)
        const userBaseTokenAccount = getAssociatedTokenAddressSync(baseMint, user)
        const userQuoteTokenAccount = getAssociatedTokenAddressSync(quoteMint, user)

        const ix = await this.program.methods
            .buy(baseAmountOut, maxQuoteAmountIn)
            .accounts({
                pool,
                globalConfig: globalConfig,
                protocolFeeRecipient: PROTOCOL_FEE_RECIPIENT,
                userBaseTokenAccount,
                userQuoteTokenAccount,
                baseTokenProgram,
                quoteTokenProgram,
                program: this.program.programId,
                user: user
            })
            .instruction()

        return ix
    }

    /**
     * 
     * @param baseAmountIn BN
     * @param minQuoteAmountOut BN
     * @param tradeParam TradeType
     * @returns Promise<TransactionInstruction>
     */
    getSellInstruction = async (
        baseAmountIn: BN,
        minQuoteAmountOut: BN,
        tradeParam: TradeType
    ): Promise<TransactionInstruction> => {
        const {
            baseMint,
            baseTokenProgram,
            pool,
            quoteMint,
            quoteTokenProgram,
            user
        } = tradeParam
        const [globalConfig] = PublicKey.findProgramAddressSync([Buffer.from(GLOBAL_CONFIG_SEED)], this.program.programId)
        const userBaseTokenAccount = getAssociatedTokenAddressSync(baseMint, user)
        const userQuoteTokenAccount = getAssociatedTokenAddressSync(quoteMint, user)
        const ix = await this.program.methods
            .sell(baseAmountIn, minQuoteAmountOut)
            .accounts({
                pool,
                globalConfig: globalConfig,
                program: this.program.programId,
                protocolFeeRecipient: PROTOCOL_FEE_RECIPIENT,
                baseTokenProgram,
                quoteTokenProgram,
                userBaseTokenAccount,
                userQuoteTokenAccount,
                user: user
            })
            .instruction()
        return ix
    }

    /**
     * 
     * @param index number
     * @param baseAmountIn BN
     * @param quoteAmountIn BN
     * @param createPoolParam CreatePoolType
     * @param user PublicKey
     * @returns Promise<TransactionInstruction>
     */
    getCreatePoolInstruction = async (
        index: number,
        baseAmountIn: BN,
        quoteAmountIn: BN,
        createPoolParam: CreatePoolType,
        user: PublicKey
    ): Promise<TransactionInstruction> => {
        const {
            creator,
            baseMint,
            quoteMint,
            baseTokenProgram,
            quoteTokenProgram
        } = createPoolParam
        const [globalConfig] = PublicKey.findProgramAddressSync([Buffer.from(GLOBAL_CONFIG_SEED)], this.program.programId)
        const userBaseTokenAccount = getAssociatedTokenAddressSync(baseMint, user)
        const userQuoteTokenAccount = getAssociatedTokenAddressSync(quoteMint, user)
        const ix = await this.program.methods.createPool(index, baseAmountIn, quoteAmountIn).accounts({
            globalConfig: globalConfig,
            baseMint,
            quoteMint,
            userBaseTokenAccount,
            userQuoteTokenAccount,
            baseTokenProgram,
            quoteTokenProgram,
            creator,
            program: this.program.programId,
        })
            .instruction()

        return ix
    }

    /**
     * 
     * @param lpTokenAmountOut BN
     * @param maxBaseAmountIn BN
     * @param maxQuoteAmountIn BN
     * @param depositType DepositType
     * @returns Promise<TransactionInstruction>
     */
    getDepositInstruction = async (
        lpTokenAmountOut: BN,
        maxBaseAmountIn: BN,
        maxQuoteAmountIn: BN,
        depositType: DepositType
    ): Promise<TransactionInstruction> => {
        const { baseMint, pool, quoteMint, user } = depositType
        const [globalConfig] = PublicKey.findProgramAddressSync([Buffer.from(GLOBAL_CONFIG_SEED)], this.program.programId)
        const [lpMint] = PublicKey.findProgramAddressSync(
            [Buffer.from(LP_MINT_SEED), pool.toBuffer()],
            this.program.programId
        );
        const userBaseTokenAccount = getAssociatedTokenAddressSync(baseMint, user)
        const userQuoteTokenAccount = getAssociatedTokenAddressSync(quoteMint, user)
        const userPoolTokenAccount = getAssociatedTokenAddressSync(lpMint, user)
        const ix = await this.program.methods.deposit(lpTokenAmountOut, maxBaseAmountIn, maxQuoteAmountIn).accounts({
            globalConfig: globalConfig,
            pool,
            program: this.program.programId,
            userPoolTokenAccount,
            userBaseTokenAccount,
            userQuoteTokenAccount,
            user: user
        })
            .instruction()

        return ix
    }

    /**
     * 
     * @param disableCreatePool boolean
     * @param disableDeposit boolean
     * @param disableWithdraw boolean
     * @param disableBuy boolean
     * @param disableSell boolean
     * @returns Promise<TransactionInstruction>
     */
    getDisableInstruction = async (
        disableCreatePool: boolean,
        disableDeposit: boolean,
        disableWithdraw: boolean,
        disableBuy: boolean,
        disableSell: boolean
    ): Promise<TransactionInstruction> => {
        const [globalConfig] = PublicKey.findProgramAddressSync([Buffer.from(GLOBAL_CONFIG_SEED)], this.program.programId)

        const ix = await this.program.methods
            .disable(disableCreatePool, disableDeposit, disableWithdraw, disableBuy, disableSell)
            .accounts({
                globalConfig: globalConfig,
                program: this.program.programId
            })
            .instruction()

        return ix
    }

    /**
     * 
     * @param account PublicKey
     * @returns Promise<TransactionInstruction>
     */
    getExtendAccountInstruction = async (account: PublicKey): Promise<TransactionInstruction> => {
        const ix = await this.program.methods
            .extendAccount()
            .accounts({
                account: account,
                program: this.program.programId
            })
            .instruction()

        return ix
    }

    /**
     * 
     * @param newAdmin PublicKey
     * @returns Promise<TransactionInstruction>
     */
    getUpdateAdminInstruction = async (newAdmin: PublicKey): Promise<TransactionInstruction> => {
        const [globalConfig] = PublicKey.findProgramAddressSync([Buffer.from(GLOBAL_CONFIG_SEED)], this.program.programId)
        const ix = await this.program.methods
            .updateAdmin()
            .accounts({
                globalConfig: globalConfig,
                program: this.program.programId,
                newAdmin: newAdmin
            })
            .instruction()

        return ix
    }

    /**
     * 
     * @param lpFeeBasisPoints BN
     * @param protocolFeeBasisPoints BN
     * @param protocolFeeRecipients Array<PublicKey>
     * @returns Promise<TransactionInstruction>
     */
    getUpdateFeeConfigInstruction = async (
        lpFeeBasisPoints: BN,
        protocolFeeBasisPoints: BN,
        protocolFeeRecipients: Array<PublicKey>
    ): Promise<TransactionInstruction> => {
        const [globalConfig] = PublicKey.findProgramAddressSync([Buffer.from(GLOBAL_CONFIG_SEED)], this.program.programId)
        const ix = await this.program.methods
            .updateFeeConfig(lpFeeBasisPoints, protocolFeeBasisPoints, protocolFeeRecipients)
            .accounts({
                globalConfig: globalConfig,
                program: this.program.programId
            })
            .instruction()

        return ix
    }

    /**
     * 
     * @param lpTokenAmountIn BN
     * @param minBaseAmountOut BN
     * @param minQuoteAmountOut BN
     * @param withdrawParam WithdrawType
     * @returns Promise<TransactionInstruction>
     */
    getWithdrawInstruction = async (
        lpTokenAmountIn: BN,
        minBaseAmountOut: BN,
        minQuoteAmountOut: BN,
        withdrawParam: WithdrawType
    ): Promise<TransactionInstruction> => {
        const { baseMint, creator, index, quoteMint, user } = withdrawParam

        const [pool] = PublicKey.findProgramAddressSync([
            Buffer.from(POOL_SEED),
            new BN(index).toArrayLike(Buffer, "le", 8),
            creator.toBuffer(),
            baseMint.toBuffer(),
            quoteMint.toBuffer(),
        ], this.program.programId);
        const [lpMint] = PublicKey.findProgramAddressSync(
            [Buffer.from(LP_MINT_SEED), pool.toBuffer()],
            this.program.programId
        );
        const [userPoolTokenAccount] = PublicKey.findProgramAddressSync(
            [creator.toBuffer(), TOKEN_2022_PROGRAM_ID.toBuffer(), lpMint.toBuffer()],
            this.program.programId
        );
        const [globalConfig] = PublicKey.findProgramAddressSync([Buffer.from(GLOBAL_CONFIG_SEED)], this.program.programId)
        const userBaseTokenAccount = getAssociatedTokenAddressSync(baseMint, user)
        const userQuoteTokenAccount = getAssociatedTokenAddressSync(quoteMint, user)
        const ix = await this.program.methods
            .withdraw(lpTokenAmountIn, minBaseAmountOut, minQuoteAmountOut)
            .accounts({
                pool,
                globalConfig: globalConfig,
                userBaseTokenAccount,
                userQuoteTokenAccount,
                userPoolTokenAccount,
                program: this.program.programId,
                user: user
            })
            .instruction()

        return ix
    }
}

export default PumpSwapSDK