CREATE TABLE "alerts_history" (
	"id" text PRIMARY KEY NOT NULL,
	"signature" text NOT NULL,
	"user_id" text,
	"wallet_address" text NOT NULL,
	"wallet_label" text,
	"token_mint" text NOT NULL,
	"token_symbol" text,
	"dex_source" text,
	"amount_raw" text,
	"liquidity" real,
	"fdv" real,
	"market_cap" real,
	"mint_authority" text,
	"freeze_authority" text,
	"ai_summary" text,
	"telegram_sent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "alerts_history_signature_unique" UNIQUE("signature")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"stripe_subscription_id" text NOT NULL,
	"stripe_price_id" text NOT NULL,
	"status" text NOT NULL,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "tracked_wallets" (
	"id" text PRIMARY KEY NOT NULL,
	"address" text NOT NULL,
	"label" text,
	"category" text,
	"source" text NOT NULL,
	"composite_score" real,
	"win_rate" real,
	"pnl" real,
	"trade_count" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_discovered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tracked_wallets_address_unique" UNIQUE("address")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"clerk_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"stripe_customer_id" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id"),
	CONSTRAINT "users_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
ALTER TABLE "alerts_history" ADD CONSTRAINT "alerts_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;