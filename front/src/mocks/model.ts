import { recipesStateSchema, createRecipesState, type RecipesState } from './recipes.js';
import {
    shoppingReceiptsStateSchema,
    createShoppingReceiptsState,
    type ShoppingReceiptsState,
} from './shopping-receipts.js';
import { preservesStateSchema, createPreservesState, type PreservesState } from './preserves.js';
import {
    recipeWorkspaceStateSchema,
    createRecipeWorkspaceState,
    type RecipeWorkspaceState,
} from './recipe-workspace.js';
import {
    cookingWorkflowStateSchema,
    createCookingWorkflowState,
    type CookingWorkflowState,
} from './cooking-workflow.js';
import fixture from '../../contracts/dev-users.json' with { type: 'json' };
import { z } from 'zod';
import { contracts, type Principal } from '../shared/api/contracts.generated.js';
import { accountStateSchema, createAccountState, type AccountState } from './account-model.js';
import { inventoryStateSchema, createInventoryState, type InventoryState } from './inventory.js';
import { productsStateSchema, createProductsState, type ProductsState } from './products.js';
import { mealPlanStateSchema, createMealPlanState, type MealPlanState } from './meal-plan.js';
import {
    personalizationStateSchema,
    createPersonalizationState,
    type PersonalizationState,
} from './personalization.js';
import { notificationsStateSchema, createNotificationsState, type NotificationsState } from './notifications.js';
import { supportStateSchema, createSupportState, type SupportState } from './support.js';
import { aiStateSchema, createAiState, type AiState } from './ai.js';
import { aiAppealsStateSchema, createAiAppealsState, type AiAppealsState } from './ai-appeals.js';
import { familyStateSchema, createFamilyState, type FamilyState } from './family.js';
import { subscriptionStateSchema, createSubscriptionState, type SubscriptionState } from './subscription.js';
import { privacyMockSchema, type PrivacyMock } from './privacy.js';
import { newsReadsSchema, type NewsReads } from './news.js';
import { exportsStateSchema, createExportsState, type ExportsState } from './exports.js';
import { ownershipStateSchema, createOwnershipState, type OwnershipState } from './ownership.js';
import {
    recommendationsStateSchema,
    createRecommendationsState,
    type RecommendationsState,
} from './recommendations.js';
import {
    allergenReportsStateSchema,
    createAllergenReportsState,
    type AllergenReportsState,
} from './allergen-reports.js';
import {
    accountLifecycleStateSchema,
    createAccountLifecycleState,
    type AccountLifecycleState,
} from './account-lifecycle.js';
import { moderationStateSchema, createModerationState, type ModerationState } from './moderation.js';
import { diaryStateSchema, createDiaryState, type DiaryState } from './diary.js';
import { nutritionStateSchema, createNutritionState, type NutritionState } from './nutrition.js';
import { financeStateSchema, createFinanceState, type FinanceState } from './finance.js';
import { createLegalFixtureState, legalMockStateSchema, type LegalMockState } from './legal.js';

export type Context = Principal['context'];
export type Kind = 'user' | 'staff';
export interface MockUser {
    id: string;
    login: string;
    email: string;
    name: string;
    role: string | null;
    plan: string;
    active: boolean;
    verified: boolean;
}
export interface Session {
    token: string;
    principal: Principal;
    authenticatedAt: string;
    revoked: boolean;
}
export interface Factor {
    id: string;
    userId: string;
    secret: string;
    verified: boolean;
    revoked: boolean;
    lastStep: number;
    recoveryCodes: string[];
}
export interface Challenge {
    token: string;
    userId: string;
    context: 'admin' | 'moderator';
    factorId: string;
    expires: number;
    attempts: number;
    used: boolean;
    revoked: boolean;
}
export interface MockState {
    legal: LegalMockState;
    finance: FinanceState;
    diary: DiaryState;
    nutrition: NutritionState;
    moderation: ModerationState;
    accountLifecycle: AccountLifecycleState;
    aiAppeals: AiAppealsState;
    ownership: OwnershipState;
    exports: ExportsState;
    newsReads: NewsReads;
    privacy: PrivacyMock;
    allergenReports: AllergenReportsState;
    recommendations: RecommendationsState;
    subscription: SubscriptionState;
    family: FamilyState;
    ai: AiState;
    support: SupportState;
    notifications: NotificationsState;
    personalization: PersonalizationState;
    mealPlan: MealPlanState;
    shoppingReceipts: ShoppingReceiptsState;
    preserves: PreservesState;
    recipeWorkspace: RecipeWorkspaceState;
    cookingWorkflow: CookingWorkflowState;
    recipes: RecipesState;
    inventory: InventoryState;
    products: ProductsState;
    version: 1;
    account: AccountState;
    users: MockUser[];
    sessions: Session[];
    factors: Factor[];
    challenges: Challenge[];
    csrf: Record<string, string>;
    limits: Record<string, { started: number; attempts: number }>;
}
export const mockStateSchema: z.ZodType<MockState> = z.strictObject({
    legal: legalMockStateSchema.default({}),
    finance: financeStateSchema.default(createFinanceState),
    diary: diaryStateSchema.default(createDiaryState),
    nutrition: nutritionStateSchema.default(createNutritionState),
    moderation: moderationStateSchema.default(createModerationState),
    accountLifecycle: accountLifecycleStateSchema.default(createAccountLifecycleState),
    aiAppeals: aiAppealsStateSchema.default(createAiAppealsState),
    ownership: ownershipStateSchema.default(createOwnershipState),
    exports: exportsStateSchema.default(createExportsState),
    newsReads: newsReadsSchema.default({}),
    privacy: privacyMockSchema.default({}),
    allergenReports: allergenReportsStateSchema.default(createAllergenReportsState),
    recommendations: recommendationsStateSchema.default(createRecommendationsState),
    subscription: subscriptionStateSchema.default(createSubscriptionState),
    family: familyStateSchema.default(createFamilyState),
    ai: aiStateSchema.default(createAiState),
    support: supportStateSchema.default(createSupportState),
    notifications: notificationsStateSchema.default(createNotificationsState),
    personalization: personalizationStateSchema.default(createPersonalizationState),
    mealPlan: mealPlanStateSchema.default(createMealPlanState),
    shoppingReceipts: shoppingReceiptsStateSchema.default(createShoppingReceiptsState),
    preserves: preservesStateSchema.default(createPreservesState),
    recipeWorkspace: recipeWorkspaceStateSchema.default(createRecipeWorkspaceState),
    cookingWorkflow: cookingWorkflowStateSchema.default(createCookingWorkflowState),
    recipes: recipesStateSchema.default(createRecipesState),
    inventory: inventoryStateSchema.default(createInventoryState),
    products: productsStateSchema.default(createProductsState),
    version: z.literal(1),
    account: accountStateSchema.default(createAccountState),
    users: z.array(
        z.strictObject({
            id: z.uuid(),
            login: z.string(),
            email: z.string(),
            name: z.string(),
            role: z.string().nullable(),
            plan: z.string(),
            active: z.boolean(),
            verified: z.boolean(),
        }),
    ),
    sessions: z.array(
        z.strictObject({
            token: z.string(),
            principal: contracts['GET /api/v1/auth/me'].success.shape.data.shape.user,
            authenticatedAt: z.iso.datetime(),
            revoked: z.boolean(),
        }),
    ),
    factors: z.array(
        z.strictObject({
            id: z.uuid(),
            userId: z.uuid(),
            secret: z.string(),
            verified: z.boolean(),
            revoked: z.boolean(),
            lastStep: z.number(),
            recoveryCodes: z.array(z.string()),
        }),
    ),
    challenges: z.array(
        z.strictObject({
            token: z.string(),
            userId: z.uuid(),
            context: z.enum(['admin', 'moderator']),
            factorId: z.uuid(),
            expires: z.number(),
            attempts: z.number(),
            used: z.boolean(),
            revoked: z.boolean(),
        }),
    ),
    csrf: z.record(z.string(), z.string()),
    limits: z.record(z.string(), z.strictObject({ started: z.number(), attempts: z.number() })),
});
export const fixturePassword = fixture.password;
export const fixtureUserIds = new Set(fixture.users.map((user) => user.id));
export function createSeed(): MockState {
    return {
        legal: createLegalFixtureState(fixture.users.map((user) => user.id)),
        finance: createFinanceState(),
        diary: createDiaryState(),
        nutrition: createNutritionState(),
        moderation: createModerationState(),
        accountLifecycle: createAccountLifecycleState(),
        aiAppeals: createAiAppealsState(),
        privacy: {},
        ownership: createOwnershipState(),
        exports: createExportsState(),
        newsReads: {},
        allergenReports: createAllergenReportsState(),
        recommendations: createRecommendationsState(),
        subscription: createSubscriptionState(),
        family: createFamilyState(),
        ai: createAiState(),
        support: createSupportState(),
        notifications: createNotificationsState(),
        personalization: createPersonalizationState(),
        version: 1,
        mealPlan: createMealPlanState(),
        shoppingReceipts: createShoppingReceiptsState(),
        preserves: createPreservesState(),
        recipes: createRecipesState(),
        recipeWorkspace: createRecipeWorkspaceState(),
        cookingWorkflow: createCookingWorkflowState(),
        inventory: createInventoryState(),
        products: createProductsState(),
        account: createAccountState(),
        users: fixture.users.map((user) => ({ ...user, active: true, verified: true })),
        sessions: [],
        factors: [],
        challenges: [],
        csrf: {},
        limits: {},
    };
}
export interface Repository {
    // Synchronous callback keeps IndexedDB read-modify-write atomic across tabs.
    transaction<T>(work: (state: MockState) => T): Promise<T>;
}
