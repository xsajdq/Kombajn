/// <reference types="cypress" />

describe('Authentication Flow', () => {
  it('should allow a user to sign up and then log out', () => {
    const user = {
      name: 'Test User',
      email: `test-${Date.now()}@example.com`,
      password: 'password123',
    };

    // --- Sign Up ---
    cy.visit('/');

    // Go to register tab
    cy.get('[data-auth-tab="register"]').click();

    // Fill out the form
    cy.get('#registerName').type(user.name);
    cy.get('#registerEmail').type(user.email);
    cy.get('#registerPassword').type(user.password);

    // Submit
    cy.get('#registerForm').submit();

    // --- Verify Setup Page ---
    // After signup, user should be logged in and redirected to the setup page
    cy.url().should('include', '/'); // Should still be on a root-path handled by the client
    cy.contains("Let's Get You Set Up").should('be.visible');
    cy.contains(user.name).should('be.visible');

    // --- Log Out ---
    cy.get('[data-logout-button]').click();

    // --- Verify Log In Page ---
    // After logout, user should be on the login page
    cy.url().should('include', '/');
    cy.contains('Welcome Back!').should('be.visible');
    cy.get('#loginEmail').should('be.visible');
  });
});
