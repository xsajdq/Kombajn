/// <reference types="cypress" />

Cypress.Commands.add('seed', () => {
  cy.task('seed');
});

// Augment the Cypress namespace
declare namespace Cypress {
  interface Chainable {
    seed(): Chainable<void>;
  }
}
