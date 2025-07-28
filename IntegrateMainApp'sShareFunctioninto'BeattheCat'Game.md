# Integrate Main App's Share Function into 'Beat the Cat' Game

## Core Features

- Refactor the 'Beat the Cat' game to replace its custom share functionality.

- Integrate the main application's reusable sharing component for a consistent user experience.

- Pass game-specific data, such as score and title, to the centralized sharing function.

## Tech Stack

{
  "Web": {
    "arch": "react",
    "component": null
  }
}

## Design

This is a functional refactoring task. The UI of the 'Share' button will remain unchanged, but its action will now trigger the main application's standardized sharing interface.

## Plan

Note: 

- [ ] is holding
- [/] is doing
- [X] is done

---

[ ] Locate and analyze the main application's shared sharing function/component to understand its API (required props, etc.).

[ ] Identify the game-over component in the "Beat the Cat" game source code that contains the current share button.

[ ] Remove the old, game-specific sharing logic from the "Beat the Cat" game-over component.

[ ] Import and integrate the main application's shared sharing function into the "Beat the Cat" game-over component.

[ ] Connect the "Share" button's `onClick` event to trigger the new shared function, passing necessary data like score and game URL.

[ ] Test the new sharing functionality within the "Beat the Cat" game to ensure it works as expected.
