import { handle } from "@/lib/server/http";
import { OPS } from "@/lib/server/admin/ops";
import { runAdminOp } from "@/lib/server/admin/op";

export async function POST(request: Request, context: RouteContext<"/api/admin/op/[name]">) {
  return handle(async () => {
    const { name } = await context.params;
    return runAdminOp(request, OPS, name);
  });
}
