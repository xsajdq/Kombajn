import './commands';

// Reset the database before each test
beforeEach(() => {
  cy.seed();
});