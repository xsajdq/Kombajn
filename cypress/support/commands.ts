/// <reference types="cypress" />

Cypress.Commands.add('seed', () => {
  cy.task('seed');
});

declare global {
  namespace Cypress {
    interface Chainable {
      seed(): Chainable<void>;
    }
  }
}

export {};
