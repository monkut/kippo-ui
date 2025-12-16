/**
 * Unified API client exports
 * Generated from OpenAPI spec via orval
 */

// Re-export all models/types
export * from "./models";

// Re-export token/auth functions
export * from "./token/token";

// Re-export project functions (KippoProject endpoints)
export * from "./projects/projects";

// Re-export requirements functions (with /api/requirements/ prefix)
export {
  // Assumptions
  requirementsAssumptionsList,
  requirementsAssumptionsCreate,
  requirementsAssumptionsRetrieve,
  requirementsAssumptionsUpdate,
  requirementsAssumptionsPartialUpdate,
  requirementsAssumptionsDestroy,
  requirementsAssumptionsCategoriesRetrieve,
  // Business Requirement Categories
  requirementsBusinessRequirementCategoriesList,
  requirementsBusinessRequirementCategoriesCreate,
  requirementsBusinessRequirementCategoriesRetrieve,
  requirementsBusinessRequirementCategoriesUpdate,
  requirementsBusinessRequirementCategoriesPartialUpdate,
  requirementsBusinessRequirementCategoriesDestroy,
  // Business Requirement Comments
  requirementsBusinessRequirementCommentsList,
  requirementsBusinessRequirementCommentsCreate,
  requirementsBusinessRequirementCommentsRetrieve,
  requirementsBusinessRequirementCommentsUpdate,
  requirementsBusinessRequirementCommentsPartialUpdate,
  requirementsBusinessRequirementCommentsDestroy,
  requirementsBusinessRequirementCommentsToggleResolvedCreate,
  // Business Requirements
  requirementsBusinessRequirementsList,
  requirementsBusinessRequirementsCreate,
  requirementsBusinessRequirementsRetrieve,
  requirementsBusinessRequirementsUpdate,
  requirementsBusinessRequirementsPartialUpdate,
  requirementsBusinessRequirementsDestroy,
  // Estimates
  requirementsEstimatesList,
  requirementsEstimatesCreate,
  requirementsEstimatesRetrieve,
  requirementsEstimatesUpdate,
  requirementsEstimatesPartialUpdate,
  requirementsEstimatesDestroy,
  // GitHub Issues
  requirementsGithubIssuesList,
  requirementsGithubIssuesCreate,
  requirementsGithubIssuesRetrieve,
  requirementsGithubIssuesUpdate,
  requirementsGithubIssuesPartialUpdate,
  requirementsGithubIssuesDestroy,
  // Problem Definitions
  requirementsProblemDefinitionsList,
  requirementsProblemDefinitionsCreate,
  requirementsProblemDefinitionsRetrieve,
  requirementsProblemDefinitionsUpdate,
  requirementsProblemDefinitionsPartialUpdate,
  requirementsProblemDefinitionsDestroy,
  // Technical Requirement Categories
  requirementsTechnicalRequirementCategoriesList,
  requirementsTechnicalRequirementCategoriesCreate,
  requirementsTechnicalRequirementCategoriesRetrieve,
  requirementsTechnicalRequirementCategoriesUpdate,
  requirementsTechnicalRequirementCategoriesPartialUpdate,
  requirementsTechnicalRequirementCategoriesDestroy,
  // Technical Requirement Comments
  requirementsTechnicalRequirementCommentsList,
  requirementsTechnicalRequirementCommentsCreate,
  requirementsTechnicalRequirementCommentsRetrieve,
  requirementsTechnicalRequirementCommentsUpdate,
  requirementsTechnicalRequirementCommentsPartialUpdate,
  requirementsTechnicalRequirementCommentsDestroy,
  // Technical Requirements
  requirementsTechnicalRequirementsList,
  requirementsTechnicalRequirementsCreate,
  requirementsTechnicalRequirementsRetrieve,
  requirementsTechnicalRequirementsUpdate,
  requirementsTechnicalRequirementsPartialUpdate,
  requirementsTechnicalRequirementsDestroy,
} from "./requirements/requirements";

// Aliases for backward compatibility (old names without 'requirements' prefix)
// These map to the correct /api/requirements/... endpoints
export {
  requirementsAssumptionsList as assumptionsList,
  requirementsAssumptionsCreate as assumptionsCreate,
  requirementsAssumptionsRetrieve as assumptionsRetrieve,
  requirementsAssumptionsUpdate as assumptionsUpdate,
  requirementsAssumptionsPartialUpdate as assumptionsPartialUpdate,
  requirementsAssumptionsDestroy as assumptionsDestroy,
  requirementsAssumptionsCategoriesRetrieve as assumptionsCategoriesRetrieve,
  requirementsBusinessRequirementCategoriesList as businessRequirementCategoriesList,
  requirementsBusinessRequirementCategoriesCreate as businessRequirementCategoriesCreate,
  requirementsBusinessRequirementCategoriesRetrieve as businessRequirementCategoriesRetrieve,
  requirementsBusinessRequirementCategoriesUpdate as businessRequirementCategoriesUpdate,
  requirementsBusinessRequirementCategoriesPartialUpdate as businessRequirementCategoriesPartialUpdate,
  requirementsBusinessRequirementCategoriesDestroy as businessRequirementCategoriesDestroy,
  requirementsBusinessRequirementCommentsList as businessRequirementCommentsList,
  requirementsBusinessRequirementCommentsCreate as businessRequirementCommentsCreate,
  requirementsBusinessRequirementCommentsRetrieve as businessRequirementCommentsRetrieve,
  requirementsBusinessRequirementCommentsUpdate as businessRequirementCommentsUpdate,
  requirementsBusinessRequirementCommentsPartialUpdate as businessRequirementCommentsPartialUpdate,
  requirementsBusinessRequirementCommentsDestroy as businessRequirementCommentsDestroy,
  requirementsBusinessRequirementCommentsToggleResolvedCreate as businessRequirementCommentsToggleResolvedCreate,
  requirementsBusinessRequirementsList as businessRequirementsList,
  requirementsBusinessRequirementsCreate as businessRequirementsCreate,
  requirementsBusinessRequirementsRetrieve as businessRequirementsRetrieve,
  requirementsBusinessRequirementsUpdate as businessRequirementsUpdate,
  requirementsBusinessRequirementsPartialUpdate as businessRequirementsPartialUpdate,
  requirementsBusinessRequirementsDestroy as businessRequirementsDestroy,
  requirementsEstimatesList as estimatesList,
  requirementsEstimatesCreate as estimatesCreate,
  requirementsEstimatesRetrieve as estimatesRetrieve,
  requirementsEstimatesUpdate as estimatesUpdate,
  requirementsEstimatesPartialUpdate as estimatesPartialUpdate,
  requirementsEstimatesDestroy as estimatesDestroy,
  requirementsGithubIssuesList as githubIssuesList,
  requirementsGithubIssuesCreate as githubIssuesCreate,
  requirementsGithubIssuesRetrieve as githubIssuesRetrieve,
  requirementsGithubIssuesUpdate as githubIssuesUpdate,
  requirementsGithubIssuesPartialUpdate as githubIssuesPartialUpdate,
  requirementsGithubIssuesDestroy as githubIssuesDestroy,
  requirementsProblemDefinitionsList as problemDefinitionsList,
  requirementsProblemDefinitionsCreate as problemDefinitionsCreate,
  requirementsProblemDefinitionsRetrieve as problemDefinitionsRetrieve,
  requirementsProblemDefinitionsUpdate as problemDefinitionsUpdate,
  requirementsProblemDefinitionsPartialUpdate as problemDefinitionsPartialUpdate,
  requirementsProblemDefinitionsDestroy as problemDefinitionsDestroy,
  requirementsTechnicalRequirementCategoriesList as technicalRequirementCategoriesList,
  requirementsTechnicalRequirementCategoriesCreate as technicalRequirementCategoriesCreate,
  requirementsTechnicalRequirementCategoriesRetrieve as technicalRequirementCategoriesRetrieve,
  requirementsTechnicalRequirementCategoriesUpdate as technicalRequirementCategoriesUpdate,
  requirementsTechnicalRequirementCategoriesPartialUpdate as technicalRequirementCategoriesPartialUpdate,
  requirementsTechnicalRequirementCategoriesDestroy as technicalRequirementCategoriesDestroy,
  requirementsTechnicalRequirementCommentsList as technicalRequirementCommentsList,
  requirementsTechnicalRequirementCommentsCreate as technicalRequirementCommentsCreate,
  requirementsTechnicalRequirementCommentsRetrieve as technicalRequirementCommentsRetrieve,
  requirementsTechnicalRequirementCommentsUpdate as technicalRequirementCommentsUpdate,
  requirementsTechnicalRequirementCommentsPartialUpdate as technicalRequirementCommentsPartialUpdate,
  requirementsTechnicalRequirementCommentsDestroy as technicalRequirementCommentsDestroy,
  requirementsTechnicalRequirementsList as technicalRequirementsList,
  requirementsTechnicalRequirementsCreate as technicalRequirementsCreate,
  requirementsTechnicalRequirementsRetrieve as technicalRequirementsRetrieve,
  requirementsTechnicalRequirementsUpdate as technicalRequirementsUpdate,
  requirementsTechnicalRequirementsPartialUpdate as technicalRequirementsPartialUpdate,
  requirementsTechnicalRequirementsDestroy as technicalRequirementsDestroy,
} from "./requirements/requirements";

// Re-export assignment rates functions
export * from "./assignment-rates/assignment-rates";
