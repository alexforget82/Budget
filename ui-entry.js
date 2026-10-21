// Native ES modules, initialized in the verified dependency order. No build step.
import { initialize as initializeCore } from "./app.js?v=13.1.1";
import { initialize as initializeFeatures } from "./features.js?v=13.1.1";
import { initialize as initializePlanningScreens } from "./planner.js?v=13.1.1";
import { initialize as initializeTransactions } from "./transactions.js?v=13.1.1";
import { initialize as initializeForecast } from "./forecast-ui.js?v=13.1.1";
import { initialize as initializePlanningReview } from "./planning-workflow.js?v=13.1.1";
import { initialize as initializeCardPayments } from "./card-payments-ui.js?v=13.1.1";
import { initialize as initializePlanningWorkspace } from "./planning-v4.js?v=13.1.1";
import { initialize as initializeWorkspaceTools } from "./budget-v41.js?v=13.1.1";
import { initialize as initializeFlexibleBudgets } from "./free-budgets-ui.js?v=13.1.1";
import { initialize as initializeEnvelopeTools } from "./envelope-v44.js?v=13.1.1";
import { initialize as initializeCategories } from "./categories-v46.js?v=13.1.1";
import { initialize as initializeDashboardLayout } from "./dashboard-v47.js?v=13.1.1";
import { initialize as initializePriorities } from "./budget-v50.js?v=13.1.1";
import { initialize as initializeBudgets } from "./budget-v60.js?v=13.1.1";
import { initialize as initializeSetup } from "./budget-v70.js?v=13.1.1";
import { initialize as initializeBankScope } from "./budget-v71.js?v=13.1.1";
import { initialize as initializeEnvelopeAdvances } from "./budget-v73.js?v=13.1.1";
import { initialize as initializeOverview } from "./budget-v80.js?v=13.1.1";
import { initialize as initializeExplanations } from "./budget-v81.js?v=13.1.1";
import { initialize as initializeWorkspace } from "./sillage.js?v=13.1.1";
import { initialize as initializeReviewAndScenarios } from "./sillage-v10.js?v=13.1.1";
import { initialize as initializeNavigation } from "./sillage-2026.js?v=13.1.1";

import { initialize as initializeMobile } from "./mobile-ui.js?v=13.1.1";

import { initialize as initializeVisualRefresh } from "./sillage-v13.js?v=13.1.1";

import { initialize as initializeActualPayments } from "./card-payment-actual-ui.js?v=13.1.1";

const runtime = Object.create(null);
initializeCore(runtime);
for (const name of Object.keys(runtime)) {
  const source = Object.getOwnPropertyDescriptor(runtime, name);
  Object.defineProperty(globalThis, name, {
    configurable: true,
    get: () => runtime[name],
    ...(source.set
      ? {
          set: (value) => {
            runtime[name] = value;
          },
        }
      : {}),
  });
}
initializeFeatures(runtime);
initializePlanningScreens(runtime);
initializeTransactions(runtime);
initializeForecast(runtime);
initializePlanningReview(runtime);
initializeCardPayments(runtime);
initializePlanningWorkspace(runtime);
initializeWorkspaceTools(runtime);
initializeFlexibleBudgets(runtime);
initializeEnvelopeTools(runtime);
initializeCategories(runtime);
initializeDashboardLayout(runtime);
initializePriorities(runtime);
initializeBudgets(runtime);
initializeSetup(runtime);
initializeBankScope(runtime);
initializeEnvelopeAdvances(runtime);
initializeOverview(runtime);
initializeExplanations(runtime);
initializeWorkspace(runtime);
initializeReviewAndScenarios(runtime);
initializeNavigation(runtime);
initializeMobile(runtime);
initializeVisualRefresh(runtime);
initializeActualPayments(runtime);
Object.defineProperty(globalThis, "budgetRuntime", {
  value: runtime,
  configurable: true,
});
