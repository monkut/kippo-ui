# kippo-ui Page Design

This document provides the UI page requirements/features.
Use best and modern design practices when implementing pages.

## Standard Page design

### Header

- Show APP title center
- include 'login' button upper right, when user not logged in.
  - When not logged in NO data should be displayed.
  - When logged in show username with a 'log out' button
- Upper left includes the 'hamburger' button, providing access to a collapsable menu of page links/features.


## Pages

### Login

- Accessible via 'login' button

### Project List

Initial 'start' Page Post Login

- Lists existing projects
- Shows 'Add Requirement Project' button

- Project Creation Page
  - Provide form for 'Requirement Project' initial creation
  
- Requirement Project Details page
  - Displays Project details
  - Allows creation of ProjectAssumption(s)
  - Allows creation of ProjectBusinessRequirement(s) 
    - Clicking on a created ProjectBusinessRequirement will move to the ProjectBusinessRequirement detail page

- ProjectBusinessRequirement list page

    > Allow expand of ProjectBusinessRequirement details (default only show title)

  - display all ProjectBusinessRequirement(s) for a given project
  - Allow 'creation' of new ProjectBusinessRequirement
  - For each defined ProjectBusinessRequirement show stats:
    - number of related ProjectTechnicalRequirement(s)
    - number of ProjectBusinessRequirementComment(s)
  - Allow navigation to "ProjectBusinessRequirement details page" 
    
- ProjectBusinessRequirement details page
  - Displays ProjectBusinessRequirement details
  - Allows creation of 1 or more related ProjectTechnicalRequirement
    - When ProjectTechnicalRequirement is created:
      - Show existing categories available for selection
      - Allow creation of new ProjectTechnicalRequirementCategory
      - Include setting of ProjectBusinessRequirementEstimate
    - Given a ProjectBusinessRequirement allow users to comment
      - A user can comment (respond) to a comment

- Requirement Project Summary
  - Displays resulting Estimates 
    - aggregated by ProjectTechnicalRequirementCategory
      - total days (sum of days)
      - confidence adjusted days (sum of Confidence Adjusted StaffDays) (days x (1 + 1 - confidence))
      - estimated cost: (sum of days) x (ProjectRate.daily_rate)
      - confidence adjusted cost:  (confidence adjusted days)  x (ProjectRate.daily_rate) 