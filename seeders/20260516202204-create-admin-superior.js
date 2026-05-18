'use strict';
const bcrypt = require('bcryptjs');

module.exports = {
  async up(queryInterface, Sequelize) {
    const hashedPassword = await bcrypt.hash('12661266', 12);
    
    // Get the admin_superior role id
    const [roles] = await queryInterface.sequelize.query(
      "SELECT id FROM roles WHERE nombre = 'admin_superior' LIMIT 1"
    );
    
    if (roles && roles.length > 0) {
      const adminRoleId = roles[0].id;
      
      await queryInterface.bulkInsert('usuarios', [
        {
          rol_id: adminRoleId,
          nombre: 'Admin',
          apellido: 'Superior',
          email: 'zait@lavaya.com',
          password_hash: hashedPassword,
          activo: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ], { ignoreDuplicates: true });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('usuarios', { email: 'zait@lavaya.com' }, {});
  }
};
