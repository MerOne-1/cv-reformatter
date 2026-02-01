import { auth } from "../lib/auth";

async function main() {
  const email = "merwan.mezrag@rupturae.com";
  const password = "Merwan";
  const name = "Merwan";

  try {
    // Use better-auth's internal API to create user with password
    const ctx = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name,
      },
    });

    console.log("✓ User created via better-auth API");
    console.log(`  Email: ${email}`);
    console.log(`  Name: ${name}`);
    console.log(`  Password: ${password}`);
  } catch (error: unknown) {
    if (error instanceof Error && error.message?.includes("already exists")) {
      console.log(`User ${email} already exists`);
    } else {
      throw error;
    }
  }
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
