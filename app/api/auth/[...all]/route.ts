import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";

// Better Auth の全エンドポイント（/api/auth/*）をこのハンドラで処理する。
export const { GET, POST } = toNextJsHandler(auth);
