import Marketing from "../../../components/marketing";
import { products, solutions, resources } from "../../../lib/marketing";
import { notFound } from "next/navigation";
const allowed = [
  "about",
  "contact",
  "privacy",
  "terms",
  "sitemap",
  ...products.map((p) => "product/" + p.slug),
  ...solutions.map((p) => "solutions/" + p.slug),
  ...resources.map((p) => "resources/" + p.slug),
];
export function generateStaticParams() {
  return allowed.map((p) => ({ slug: p.split("/") }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const name =
    [...products, ...solutions, ...resources].find(
      (p) => p.slug === slug.at(-1),
    )?.title || slug.at(-1);
  return { title: `${name} · TableQ` };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  if (!allowed.includes(slug.join("/"))) notFound();
  return <Marketing page="detail" slug={slug} />;
}
