CREATE TABLE "telegram_bindings" (
	"id" text PRIMARY KEY NOT NULL,
	"clerk_user_id" text NOT NULL,
	"telegram_id" bigint NOT NULL,
	"telegram_username" text,
	"bound_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unbound_at" timestamp with time zone,
	CONSTRAINT "telegram_bindings_clerk_user_id_unique" UNIQUE("clerk_user_id"),
	CONSTRAINT "telegram_bindings_telegram_id_unique" UNIQUE("telegram_id")
);
--> statement-breakpoint
ALTER TABLE "alerts_history" ADD COLUMN "volume24h" real;--> statement-breakpoint
ALTER TABLE "telegram_bindings" ADD CONSTRAINT "telegram_bindings_clerk_user_id_users_clerk_id_fk" FOREIGN KEY ("clerk_user_id") REFERENCES "public"."users"("clerk_id") ON DELETE no action ON UPDATE no action;