import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME } from "@/lib/session";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SignInContent } from "./SignInContent";

export const metadata = {
  title: "Login | BTC Today",
  description: "Login to access your BTC Today Pro subscription.",
};

export default async function SignInPage() {
  // If already signed in, redirect home
  const cookieStore = await cookies();
  const session = cookieStore.get(COOKIE_NAME)?.value;
  if (session) {
    try {
      const { email } = JSON.parse(session);
      if (email) redirect("/");
    } catch { /* invalid cookie, show sign-in */ }
  }

  return (
    <>
      <Header />
      <SignInContent />
      <Footer />
    </>
  );
}
