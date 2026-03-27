import { AppShell } from "@/components/layout/AppShell";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

function App() {
  return (
    <TooltipProvider>
      <AppShell />
      <Toaster richColors position="bottom-right" />
    </TooltipProvider>
  );
}

export default App;
