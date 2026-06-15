import { ContractLookupPanel } from "@/app/components/contract-lookup-panel";
import { DemoDataProvider } from "@/app/components/demo-data-provider";
import { DEMO_SEED } from "@/app/lib/demo/seed-data";
import { loadContactSettings } from "@/app/lib/utility/repository";

export default async function HomePage() {
  const settings = await loadContactSettings();

  return (
    <DemoDataProvider initialState={{ ...DEMO_SEED, settings }}>
      <main className="page">
        <ContractLookupPanel />
      </main>
    </DemoDataProvider>
  );
}
