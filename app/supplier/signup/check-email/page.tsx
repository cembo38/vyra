import { redirect } from "next/navigation";

export default async function SupplierCheckEmailRedirect(props: PageProps<"/supplier/signup/check-email">) {
  const params = await props.searchParams;
  const email = typeof params.email === "string" ? params.email : "";
  redirect(`/signup/check-email${email ? `?email=${encodeURIComponent(email)}` : ""}`);
}
