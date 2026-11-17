"use client";

import * as React from "react";
import { Sun, Moon, Laptop, Plus, ShoppingBag, Clock, Sparkles, Info } from "lucide-react";
import { useTheme } from "@/components/theme";
import {
  Button,
  Input,
  Textarea,
  Badge,
  Card,
  Skeleton,
  Switch,
  Checkbox,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  KPICard,
  ListRow,
  QuantityStepper,
  useToast,
} from "@/components/ui";
import { SoonItem, EmptyState, ErrorState } from "@/components/feedback";

export default function PatternsPage() {
  const { theme, resolvedTheme, setTheme, mounted } = useTheme();
  const { showToast } = useToast();

  const [stepperVal, setStepperVal] = React.useState(2);
  const [switchVal, setSwitchVal] = React.useState(true);
  const [checkVal, setCheckVal] = React.useState(true);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);

  return (
    <div className="bg-background text-foreground min-h-screen pb-20 transition-colors duration-150">
      {/* Sticky Top Toolbar with Theme Switcher */}
      <header className="border-border bg-card/90 sticky top-0 z-40 border-b px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-primary h-2.5 w-2.5 rounded-full" />
              <h1 className="text-title-md">P-01 Patterns</h1>
            </div>
            <p className="text-muted-foreground text-xs">FoodBiz Component Inventory</p>
          </div>

          {/* Theme Mode Segmented Control */}
          <div className="border-border bg-muted flex items-center rounded-lg border p-1">
            <Button
              variant="unstyled"
              size="none"
              type="button"
              onClick={() => setTheme("light")}
              className={`rounded p-1.5 transition-colors ${
                theme === "light"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Light Mode"
              data-testid="theme-light-btn"
            >
              <Sun className="h-4 w-4" />
            </Button>
            <Button
              variant="unstyled"
              size="none"
              type="button"
              onClick={() => setTheme("dark")}
              className={`rounded p-1.5 transition-colors ${
                theme === "dark"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Dark Mode"
              data-testid="theme-dark-btn"
            >
              <Moon className="h-4 w-4" />
            </Button>
            <Button
              variant="unstyled"
              size="none"
              type="button"
              onClick={() => setTheme("system")}
              className={`rounded p-1.5 transition-colors ${
                theme === "system"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="System Default"
              data-testid="theme-system-btn"
            >
              <Laptop className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Device Frame Container (390px max-width) */}
      <main className="mx-auto max-w-md space-y-8 px-4 py-6">
        {/* Banner Note */}
        <div className="border-border bg-card text-body-sm text-muted-foreground flex items-start gap-2.5 rounded-md border p-3">
          <Info className="text-primary mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Replicating Stitch reference screens in{" "}
            <strong suppressHydrationWarning>{mounted ? resolvedTheme : "system"}</strong> mode. All
            touch targets ≥ 44px, tabular figures, and WCAG AA contrast.
          </p>
        </div>

        {/* 1. BUTTONS */}
        <section className="space-y-3" data-testid="section-buttons">
          <div className="text-label-sm text-muted-foreground tracking-wider uppercase">
            1. Buttons
          </div>
          <Card className="space-y-3 p-4">
            <div>
              <div className="text-muted-foreground mb-1 text-xs">Primary (48px)</div>
              <Button className="w-full" data-testid="btn-primary">
                Save product
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-muted-foreground mb-1 text-xs">Secondary / Soft</div>
                <Button variant="secondary" className="w-full">
                  Secondary
                </Button>
              </div>
              <div>
                <div className="text-muted-foreground mb-1 text-xs">Outline</div>
                <Button variant="outline" className="w-full">
                  Outline
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-muted-foreground mb-1 text-xs">Ghost</div>
                <Button variant="ghost" className="w-full">
                  Ghost
                </Button>
              </div>
              <div>
                <div className="text-muted-foreground mb-1 text-xs">Destructive</div>
                <Button variant="destructive" className="w-full">
                  Delete
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-muted-foreground mb-1 text-xs">Loading</div>
                <Button loading className="w-full">
                  Processing
                </Button>
              </div>
              <div>
                <div className="text-muted-foreground mb-1 text-xs">Icon Button</div>
                <Button variant="outline" size="icon" className="mx-auto">
                  <Plus className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </Card>
        </section>

        {/* 2. FORM FIELDS */}
        <section className="space-y-3" data-testid="section-forms">
          <div className="text-label-sm text-muted-foreground tracking-wider uppercase">
            2. Form Fields
          </div>
          <Card className="space-y-4 p-4">
            <div>
              <label className="text-label-md text-foreground mb-1 block font-medium">
                Product name
              </label>
              <Input placeholder="e.g. Traditional Baguette" />
            </div>

            <div>
              <label className="text-label-md text-foreground mb-1 block font-medium">
                Price (with error state)
              </label>
              <Input error defaultValue="-2.50" />
              <p className="text-destructive mt-1 text-xs">Price must be greater than zero</p>
            </div>

            <div>
              <label className="text-label-md text-foreground mb-1 block font-medium">
                Category
              </label>
              <Select defaultValue="bakery">
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bakery">Bakery & Bread</SelectItem>
                  <SelectItem value="pastry">Pastry & Viennoiserie</SelectItem>
                  <SelectItem value="beverages">Beverages</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-label-md text-foreground mb-1 block font-medium">
                Description
              </label>
              <Textarea placeholder="Ingredients, allergen notes..." rows={2} />
            </div>

            <div className="flex items-center justify-between pt-1">
              <div>
                <span className="text-body-md text-foreground block">Available in storefront</span>
                <span className="text-body-sm text-muted-foreground block">
                  Allow online orders for this item
                </span>
              </div>
              <Switch checked={switchVal} onCheckedChange={setSwitchVal} />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Checkbox
                id="cbox-terms"
                checked={checkVal}
                onCheckedChange={(checked) => setCheckVal(Boolean(checked))}
              />
              <label htmlFor="cbox-terms" className="text-body-sm text-foreground cursor-pointer">
                Track real-time stock
              </label>
            </div>
          </Card>
        </section>

        {/* 3. STATUS PILLS */}
        <section className="space-y-3" data-testid="section-badges">
          <div className="text-label-sm text-muted-foreground tracking-wider uppercase">
            3. Status Pills
          </div>
          <Card className="p-4">
            <div className="grid grid-cols-2 gap-2">
              <Badge variant="new">NEW · Nouvelle</Badge>
              <Badge variant="confirmed">CONFIRMED · Confirmée</Badge>
              <Badge variant="preparing">PREPARING · En prép.</Badge>
              <Badge variant="ready">READY · Prête</Badge>
              <Badge variant="completed">COMPLETED · Terminée</Badge>
              <Badge variant="cancelled">CANCELLED · Annulée</Badge>
              <Badge variant="paid">Paid · Payée</Badge>
              <Badge variant="unpaid">Unpaid · Non payée</Badge>
            </div>
          </Card>
        </section>

        {/* 4. KPI CARDS */}
        <section className="space-y-3" data-testid="section-kpis">
          <div className="text-label-sm text-muted-foreground tracking-wider uppercase">
            4. KPI Card Row
          </div>
          <div className="grid grid-cols-2 gap-3">
            <KPICard
              label="Today's Revenue"
              value="€842.50"
              delta={{ percentage: 12.4, isPositive: true, periodLabel: "vs yesterday" }}
            />
            <KPICard
              label="Active Orders"
              value="14"
              delta={{ percentage: 5.2, isPositive: false, periodLabel: "vs avg" }}
            />
          </div>
        </section>

        {/* 5. LIST ROWS & SOON ITEM */}
        <section className="space-y-3" data-testid="section-lists">
          <div className="text-label-sm text-muted-foreground tracking-wider uppercase">
            5. List Rows
          </div>
          <Card className="overflow-hidden">
            <ListRow
              leading={
                <div className="bg-muted text-foreground flex h-10 w-10 items-center justify-center rounded-md">
                  <ShoppingBag className="h-5 w-5" />
                </div>
              }
              title="Artisan Sourdough"
              subtitle="Stock: 18 loaves"
              trailing="€4.50"
              onClick={() => showToast("Opening item details...")}
            />
            <ListRow
              leading={
                <div className="bg-muted text-foreground flex h-10 w-10 items-center justify-center rounded-md">
                  <Clock className="h-5 w-5" />
                </div>
              }
              title="Order #1042"
              subtitle="Pickup · 12:30"
              trailing={<Badge variant="ready">READY</Badge>}
              onClick={() => showToast("Opening order #1042...")}
            />
            <SoonItem
              featureKey="orders.export"
              leading={<Sparkles className="text-muted-foreground h-5 w-5" />}
            />
          </Card>
        </section>

        {/* 6. SEGMENTED FILTER TABS */}
        <section className="space-y-3" data-testid="section-tabs">
          <div className="text-label-sm text-muted-foreground tracking-wider uppercase">
            6. Segmented Filter Tabs
          </div>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">All (38)</TabsTrigger>
              <TabsTrigger value="active">Active (14)</TabsTrigger>
              <TabsTrigger value="completed">Done (24)</TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="pt-2">
              <p className="text-muted-foreground text-center text-xs">
                Displaying all orders across all statuses.
              </p>
            </TabsContent>
            <TabsContent value="active" className="pt-2">
              <p className="text-muted-foreground text-center text-xs">
                Filtered: orders requiring kitchen action.
              </p>
            </TabsContent>
            <TabsContent value="completed" className="pt-2">
              <p className="text-muted-foreground text-center text-xs">
                History: completed and archived orders.
              </p>
            </TabsContent>
          </Tabs>
        </section>

        {/* 7. QUANTITY STEPPER */}
        <section className="space-y-3" data-testid="section-stepper">
          <div className="text-label-sm text-muted-foreground tracking-wider uppercase">
            7. Quantity Stepper
          </div>
          <Card className="flex items-center justify-between p-4">
            <div>
              <span className="text-body-md block">Croissants</span>
              <span className="text-body-sm text-muted-foreground block">€2.20 each</span>
            </div>
            <QuantityStepper value={stepperVal} min={1} max={20} onChange={setStepperVal} />
          </Card>
        </section>

        {/* 8. EMPTY STATE CARD */}
        <section className="space-y-3" data-testid="section-empty">
          <div className="text-label-sm text-muted-foreground tracking-wider uppercase">
            8. Empty State Card
          </div>
          <EmptyState
            title="No orders right now"
            description="When customers place orders online or you record manual sales, they will appear here."
            action={{
              label: "New manual order",
              onClick: () => showToast("Opening manual order sheet..."),
            }}
          />
        </section>

        {/* 9. ERROR STATE CARD */}
        <section className="space-y-3" data-testid="section-error">
          <div className="text-label-sm text-muted-foreground tracking-wider uppercase">
            9. Error State Card
          </div>
          <ErrorState
            title="Failed to sync catalogue"
            message="We couldn't connect to the server to update product availability."
            onRetry={() => showToast("Retrying connection...")}
            retryLabel="Retry connection"
          />
        </section>

        {/* 10. LOADING SKELETON */}
        <section className="space-y-3" data-testid="section-skeleton">
          <div className="text-label-sm text-muted-foreground tracking-wider uppercase">
            10. Loading Skeleton (No Shimmer)
          </div>
          <Card className="space-y-3 p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded-md" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <Skeleton className="h-12 w-full" />
          </Card>
        </section>

        {/* 11. TOAST INTERACTION */}
        <section className="space-y-3" data-testid="section-toast">
          <div className="text-label-sm text-muted-foreground tracking-wider uppercase">
            11. Toast (Floating Pill)
          </div>
          <Card className="flex items-center justify-between p-4">
            <span className="text-body-sm text-muted-foreground">Trigger a floating snackbar</span>
            <Button
              variant="outline"
              onClick={() => showToast("Order #1042 marked as READY")}
              data-testid="trigger-sample-toast"
            >
              Show Toast
            </Button>
          </Card>
        </section>

        {/* 12. OVERLAYS (SHEET & DIALOG) */}
        <section className="space-y-3" data-testid="section-overlays">
          <div className="text-label-sm text-muted-foreground tracking-wider uppercase">
            12. Bottom Sheet & Dialog
          </div>
          <div className="grid grid-cols-2 gap-3">
            {/* Dialog Trigger */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  Open Dialog
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cancel Order #1042?</DialogTitle>
                  <DialogDescription>
                    This will release the reserved stock back to the inventory and notify the
                    kitchen.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Keep order
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setIsDialogOpen(false);
                      showToast("Order #1042 cancelled");
                    }}
                  >
                    Confirm cancel
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Bottom Sheet Trigger */}
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="w-full">
                  Open Sheet
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom">
                <SheetHeader>
                  <SheetTitle>Record Payment</SheetTitle>
                  <SheetDescription>
                    Select the payment method used by the customer.
                  </SheetDescription>
                </SheetHeader>
                <div className="space-y-2 py-4">
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left"
                    onClick={() => {
                      setIsSheetOpen(false);
                      showToast("Payment recorded: Cash");
                    }}
                  >
                    Cash (€14.50)
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left"
                    onClick={() => {
                      setIsSheetOpen(false);
                      showToast("Payment recorded: Revolut");
                    }}
                  >
                    Revolut (revtag)
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left"
                    onClick={() => {
                      setIsSheetOpen(false);
                      showToast("Payment recorded: Wero");
                    }}
                  >
                    Wero
                  </Button>
                </div>
                <SheetFooter>
                  <Button variant="ghost" onClick={() => setIsSheetOpen(false)} className="w-full">
                    Dismiss
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>
        </section>
      </main>
    </div>
  );
}
