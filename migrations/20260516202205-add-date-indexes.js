'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addIndex('pedidos', ['createdAt']);
    await queryInterface.addIndex('pagos', ['createdAt']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('pedidos', ['createdAt']);
    await queryInterface.removeIndex('pagos', ['createdAt']);
  }
};
