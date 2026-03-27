ALTER TABLE "game" ADD COLUMN "winner_player_id" text;--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_winner_player_id_user_id_fk" FOREIGN KEY ("winner_player_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_winner_player_id_idx" ON "game" USING btree ("winner_player_id");