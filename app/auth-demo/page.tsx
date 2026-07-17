"use client";

import { useState } from "react";

import { signIn, signOut, signUp, useSession } from "@/lib/auth-client";

/**
 * Better Auth の動作確認用の最小デモページ。
 * サインアップ / サインイン / サインアウトと、現在のセッション表示を行う。
 * 実プロダクトでは各自の UI・バリデーションに置き換えること。
 */
export default function AuthDemoPage() {
  const { data: session, isPending } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const handleSignUp = async () => {
    setMessage(null);
    const { error } = await signUp.email({ name, email, password });
    setMessage(error ? `サインアップ失敗: ${error.message}` : "サインアップ成功");
  };

  const handleSignIn = async () => {
    setMessage(null);
    const { error } = await signIn.email({ email, password });
    setMessage(error ? `サインイン失敗: ${error.message}` : "サインイン成功");
  };

  if (isPending) {
    return <main style={{ padding: 24 }}>読み込み中...</main>;
  }

  return (
    <main style={{ maxWidth: 400, margin: "40px auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>Better Auth デモ</h1>

      {session ? (
        <div>
          <p>
            ログイン中: <strong>{session.user.email}</strong>
          </p>
          <button onClick={() => signOut()} style={{ marginTop: 12 }}>
            サインアウト
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            placeholder="名前 (サインアップ用)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            placeholder="メールアドレス"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            placeholder="パスワード"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={handleSignUp}>サインアップ</button>
            <button onClick={handleSignIn}>サインイン</button>
          </div>
        </div>
      )}

      {message && <p style={{ marginTop: 16 }}>{message}</p>}
    </main>
  );
}
