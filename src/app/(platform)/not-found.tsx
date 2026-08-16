import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { T } from "@/components/i18n/t";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-lg font-semibold">
        <T k="common.notFoundTitle" />
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        <T k="common.notFoundDescription" />
      </p>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        <T k="common.backToDashboard" />
      </Link>
    </div>
  );
}
