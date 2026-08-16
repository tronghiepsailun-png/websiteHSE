import { switchOrganizationAction } from "@/app/(platform)/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { T } from "@/components/i18n/t";
import { LanguageSwitcher } from "@/components/layout/language-switcher";

export function OrganizationPicker({
  memberships,
}: {
  memberships: { id: string; name: string; code: string }[];
}) {
  return (
    <div className="relative flex flex-1 items-center justify-center p-4">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">
            <T k="org.choose" />
          </CardTitle>
          <CardDescription>
            <T k="org.chooseDescription" />
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {memberships.map((org) => (
            <form action={switchOrganizationAction} key={org.id}>
              <input type="hidden" name="organizationId" value={org.id} />
              <Button type="submit" variant="outline" className="w-full justify-between">
                <span>{org.name}</span>
                <span className="text-xs text-muted-foreground">{org.code}</span>
              </Button>
            </form>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
