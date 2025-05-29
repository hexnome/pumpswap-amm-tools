import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import {
  clusterApiUrl,
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import idl from "./idl/pump-swap.json";
import type { PumpSwapIDL } from "./idl/pump-swap.ts";
import {
  GLOBAL_CONFIG_SEED,
  LP_MINT_SEED,
  POOL_SEED,
  PROTOCOL_FEE_RECIPIENT,
  PROTOCOL_FEE_RECIPIENT_MAINNET,
} from "./constants";
import { CreatePoolType, DepositType, TradeType, WithdrawType } from "./types";
import { connection } from "../../config";

interface Pool {
  address: PublicKey;
  is_native_base: boolean;
  poolData: any;
}

interface PoolWithPrice extends Pool {
  price: number;
  reserves: {
      native: number;
      token: number;
  }
}

export class PumpSwapSDK {
  private program: Program<PumpSwapIDL>;
  private cluster: "mainnet" | "devnet";
  public connection: Connection;
  public PUMP_AMM_PROGRAM_ID: PublicKey;
  public WSOL_TOKEN_ACCOUNT: PublicKey;
  /**
   *
   * @param cluster "mainnet" | "devnet"
   * @param commitment "processed" | "confirmed" | "finalized"
   * @param customRPC string
   */
  constructor(
    cluster: "mainnet" | "devnet",
    commitment: "processed" | "confirmed" | "finalized",
  ) {
    const wallet = new NodeWallet(Keypair.generate());
    const url =
      cluster == "mainnet"
        ? clusterApiUrl("mainnet-beta")
        : clusterApiUrl("devnet");
    this.cluster = cluster;
    this.PUMP_AMM_PROGRAM_ID = new PublicKey(idl.address);
    this.WSOL_TOKEN_ACCOUNT = new PublicKey('So11111111111111111111111111111111111111112');
    this.connection = connection;
    const provider = new AnchorProvider(this.connection, wallet, {
      commitment: commitment,
    });
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
        program: this.program.programId,
      })
      .instruction();
    return ix;
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
      user,
    } = tradeParam;
    const [globalConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from(GLOBAL_CONFIG_SEED)],
      this.program.programId
    );
    console.log("quoteMint", quoteMint.toBase58());
    const userBaseTokenAccount = getAssociatedTokenAddressSync(baseMint, user);
    const userQuoteTokenAccount = getAssociatedTokenAddressSync(
      quoteMint,
      user
    );
    console.log("userBaseTokenAccount", userBaseTokenAccount.toBase58());
    const ix = await this.program.methods
      .buy(baseAmountOut, maxQuoteAmountIn)
      .accounts({
        pool,
        globalConfig: globalConfig,
        protocolFeeRecipient:
          this.cluster == "mainnet"
            ? PROTOCOL_FEE_RECIPIENT_MAINNET
            : PROTOCOL_FEE_RECIPIENT,
        userBaseTokenAccount,
        userQuoteTokenAccount,
        baseTokenProgram,
        quoteTokenProgram,
        program: this.program.programId,
        user: user,
      })
      .instruction();
    return ix;
  }

  getPoolsWithBaseMint = async (mintAddress: PublicKey) => {
      const response = await this.connection.getProgramAccounts(this.PUMP_AMM_PROGRAM_ID, {
          filters: [
              { "dataSize": 300 },
              {
                "memcmp": {
                  "offset": 43,
                  "bytes": mintAddress.toBase58()
                }
              }
            ]
          }
      )

      const mappedPools = response.map((pool) => {
          const data = Buffer.from(pool.account.data);
          const poolData = this.program.coder.accounts.decode('pool', data);
          return {
              address: pool.pubkey,
              is_native_base: false,
              poolData
          };
      })

      return mappedPools;
  }

  getPoolsWithQuoteMint = async (mintAddress: PublicKey) => {
    const response = await this.connection.getProgramAccounts(this.PUMP_AMM_PROGRAM_ID, {
        filters: [
            { "dataSize": 300 },
            {
              "memcmp": {
                "offset": 75,
                "bytes": mintAddress.toBase58()
              }
            }
          ]
        }
    )

    const mappedPools = response.map((pool) => {
        const data = Buffer.from(pool.account.data);
        const poolData = this.program.coder.accounts.decode('pool', data);
        return {
            address: pool.pubkey,
            is_native_base: true,
            poolData
        };
    })

    return mappedPools;
  }

  getPoolsWithBaseMintQuoteWSOL = async (mintAddress: PublicKey) => {
    console.log("programID", this.PUMP_AMM_PROGRAM_ID.toBase58());
    const response = await this.connection.getProgramAccounts(this.PUMP_AMM_PROGRAM_ID, {
        filters: [
            { "dataSize": 300 },
            {
              "memcmp": {
                "offset": 43,
                "bytes": mintAddress.toBase58()
              }
            },
            {
                "memcmp": {
                  "offset": 75,
                  "bytes": this.WSOL_TOKEN_ACCOUNT.toBase58()
                }
            }
          ]
        }
    )
    console.log("response", response);
    const mappedPools = response.map((pool) => {
        const data = Buffer.from(pool.account.data);
        const poolData = this.program.coder.accounts.decode('pool', data);
        return {
            address: pool.pubkey,
            is_native_base: true,
            poolData
        };
    })

    return mappedPools;
  }

  getPriceAndLiquidity = async (pool: Pool) => {
    const wsolAddress = pool.poolData.poolQuoteTokenAccount;
    const tokenAddress = pool.poolData.poolBaseTokenAccount;
  
    const wsolBalance = await this.connection.getTokenAccountBalance(wsolAddress);
    const tokenBalance = await this.connection.getTokenAccountBalance(tokenAddress);

    const price = wsolBalance.value.uiAmount! / tokenBalance.value.uiAmount!;
    console.log("before fetching price");

    return {
        ...pool,
        price,
        reserves: {
            native: wsolBalance.value.uiAmount!,
            token: tokenBalance.value.uiAmount!
        }
    } as PoolWithPrice;
  }

  getPoolsWithPrices = async (mintAddress: PublicKey) => {
    const [poolsWithBaseMint, poolsWithQuoteMint] = await Promise.all([
        this.getPoolsWithBaseMint(mintAddress),
        this.getPoolsWithQuoteMint(mintAddress)
    ])
    console.log("poolsWithBaseMint", poolsWithBaseMint);
    //const poolsWithBaseMinQuoteWSOL = await getPoolsWithBaseMintQuoteWSOL(mintAddress)
    const pools = [...poolsWithBaseMint, ...poolsWithQuoteMint];
    
    const results = await Promise.all(pools.map(this.getPriceAndLiquidity));

    const sortedByHighestLiquidity = results.sort((a, b) => b.reserves.native - a.reserves.native);
    return sortedByHighestLiquidity;
  }

  calculateWithSlippageBuy = (
    amount: bigint,
    basisPoints: bigint
  ) => {
    return amount - (amount * basisPoints) / BigInt(10000);
  };

  getBuyTokenAmount = async (solAmount: bigint, mint:PublicKey) => {
    console.log("solAmount", solAmount.toString());
    const pool_detail = await this.getPoolsWithPrices(mint);
    console.log("pool_detail", pool_detail);
    const sol_reserve = BigInt(pool_detail[0].reserves.native *LAMPORTS_PER_SOL);
    const token_reserve = BigInt(Math.floor(pool_detail[0].reserves.token * 10**6));
    const product = sol_reserve * token_reserve;
    let new_sol_reserve = sol_reserve + solAmount;
    let new_token_reserve = product / new_sol_reserve + BigInt(1);
    let amount_to_be_purchased = token_reserve - new_token_reserve;

    return amount_to_be_purchased;
  }

  getPumpSwapPool = async (mint:PublicKey) => {
    const pools = await this.getPoolsWithBaseMintQuoteWSOL(mint);
    if (!pools || pools.length === 0) {
      return null
    }
    return pools[0].address;
  }

  getPrice = async (mint:PublicKey) => {
    const pools = await this.getPoolsWithPrices(mint)
    return pools[0].price;
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
      user,
    } = tradeParam;
    const [globalConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from(GLOBAL_CONFIG_SEED)],
      this.program.programId
    );
    const userBaseTokenAccount = getAssociatedTokenAddressSync(baseMint, user);
    const userQuoteTokenAccount = getAssociatedTokenAddressSync(
      quoteMint,
      user
    );
    
    const ix = await this.program.methods
      .sell(baseAmountIn, minQuoteAmountOut)
      .accounts({
        pool,
        globalConfig: globalConfig,
        program: this.program.programId,
        protocolFeeRecipient: PROTOCOL_FEE_RECIPIENT_MAINNET,
        baseTokenProgram,
        quoteTokenProgram,
        userBaseTokenAccount,
        userQuoteTokenAccount,
        user: user,
      })
      .instruction();
    return ix;
  };

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
      quoteTokenProgram,
    } = createPoolParam;
    const [globalConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from(GLOBAL_CONFIG_SEED)],
      this.program.programId
    );
    const userBaseTokenAccount = getAssociatedTokenAddressSync(baseMint, user);
    const userQuoteTokenAccount = getAssociatedTokenAddressSync(
      quoteMint,
      user
    );
    const ix = await this.program.methods
      .createPool(index, baseAmountIn, quoteAmountIn)
      .accounts({
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
      .instruction();

    return ix;
  };

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
    const { baseMint, pool, quoteMint, user } = depositType;
    const [globalConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from(GLOBAL_CONFIG_SEED)],
      this.program.programId
    );
    const [lpMint] = PublicKey.findProgramAddressSync(
      [Buffer.from(LP_MINT_SEED), pool.toBuffer()],
      this.program.programId
    );
    const userBaseTokenAccount = getAssociatedTokenAddressSync(baseMint, user);
    const userQuoteTokenAccount = getAssociatedTokenAddressSync(
      quoteMint,
      user
    );
    const userPoolTokenAccount = getAssociatedTokenAddressSync(lpMint, user);
    const ix = await this.program.methods
      .deposit(lpTokenAmountOut, maxBaseAmountIn, maxQuoteAmountIn)
      .accounts({
        globalConfig: globalConfig,
        pool,
        program: this.program.programId,
        userPoolTokenAccount,
        userBaseTokenAccount,
        userQuoteTokenAccount,
        user: user,
      })
      .instruction();

    return ix;
  };

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
    const [globalConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from(GLOBAL_CONFIG_SEED)],
      this.program.programId
    );

    const ix = await this.program.methods
      .disable(
        disableCreatePool,
        disableDeposit,
        disableWithdraw,
        disableBuy,
        disableSell
      )
      .accounts({
        globalConfig: globalConfig,
        program: this.program.programId,
      })
      .instruction();

    return ix;
  };

  /**
   *
   * @param account PublicKey
   * @returns Promise<TransactionInstruction>
   */
  getExtendAccountInstruction = async (
    account: PublicKey
  ): Promise<TransactionInstruction> => {
    const ix = await this.program.methods
      .extendAccount()
      .accounts({
        account: account,
        program: this.program.programId,
      })
      .instruction();

    return ix;
  };

  /**
   *
   * @param newAdmin PublicKey
   * @returns Promise<TransactionInstruction>
   */
  getUpdateAdminInstruction = async (
    newAdmin: PublicKey
  ): Promise<TransactionInstruction> => {
    const [globalConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from(GLOBAL_CONFIG_SEED)],
      this.program.programId
    );
    const ix = await this.program.methods
      .updateAdmin()
      .accounts({
        globalConfig: globalConfig,
        program: this.program.programId,
        newAdmin: newAdmin,
      })
      .instruction();

    return ix;
  };

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
    const [globalConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from(GLOBAL_CONFIG_SEED)],
      this.program.programId
    );
    const ix = await this.program.methods
      .updateFeeConfig(
        lpFeeBasisPoints,
        protocolFeeBasisPoints,
        protocolFeeRecipients
      )
      .accounts({
        globalConfig: globalConfig,
        program: this.program.programId,
      })
      .instruction();

    return ix;
  };

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
    const { baseMint, creator, index, quoteMint, user } = withdrawParam;

    const [pool] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(POOL_SEED),
        new BN(index).toArrayLike(Buffer, "le", 8),
        creator.toBuffer(),
        baseMint.toBuffer(),
        quoteMint.toBuffer(),
      ],
      this.program.programId
    );
    const [lpMint] = PublicKey.findProgramAddressSync(
      [Buffer.from(LP_MINT_SEED), pool.toBuffer()],
      this.program.programId
    );
    const [userPoolTokenAccount] = PublicKey.findProgramAddressSync(
      [creator.toBuffer(), TOKEN_2022_PROGRAM_ID.toBuffer(), lpMint.toBuffer()],
      this.program.programId
    );
    const [globalConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from(GLOBAL_CONFIG_SEED)],
      this.program.programId
    );
    const userBaseTokenAccount = getAssociatedTokenAddressSync(baseMint, user);
    const userQuoteTokenAccount = getAssociatedTokenAddressSync(
      quoteMint,
      user
    );
    const ix = await this.program.methods
      .withdraw(lpTokenAmountIn, minBaseAmountOut, minQuoteAmountOut)
      .accounts({
        pool,
        globalConfig: globalConfig,
        userBaseTokenAccount,
        userQuoteTokenAccount,
        userPoolTokenAccount,
        program: this.program.programId,
        user: user,
      })
      .instruction();

    return ix;
  };
}

export default PumpSwapSDK;
