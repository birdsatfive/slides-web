export const dynamic = "force-dynamic";

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="panel-card p-8 max-w-md text-center">
        <h1 className="text-[20px] font-semibold mb-2">Not authorised</h1>
        <p className="text-[13px] text-foreground/50">
          Slides is restricted to @birdsatfive.dk and @birdie.studio accounts.
        </p>
      </div>
    </div>
  );
}
