const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

class Usuario extends Model {
  // Verifica contraseña
  async verificarPassword(password) {
    return bcrypt.compare(password, this.password_hash);
  }

  // Excluye campos sensibles al serializar
  toJSON() {
    const values = { ...this.get() };
    delete values.password_hash;
    delete values.refresh_token;
    return values;
  }
}

Usuario.init({
  id:            { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  rol_id:        { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  sucursal_id:   { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  nombre:        { type: DataTypes.STRING(80), allowNull: false },
  apellido:      { type: DataTypes.STRING(80), allowNull: false },
  email:         { type: DataTypes.STRING(150), allowNull: false, unique: true, validate: { isEmail: true } },
  telefono:      { type: DataTypes.STRING(20), allowNull: true },
  dni:           { type: DataTypes.STRING(15), allowNull: true, unique: true },
  password_hash: { type: DataTypes.STRING(255), allowNull: false },
  foto_url:      { type: DataTypes.STRING(500), allowNull: true },
  activo:        { type: DataTypes.BOOLEAN, defaultValue: true },
  ultimo_login:  { type: DataTypes.DATE, allowNull: true },
  refresh_token: { type: DataTypes.TEXT, allowNull: true },
}, {
  sequelize,
  modelName: 'Usuario',
  tableName:  'usuarios',
  timestamps: true,
  paranoid:   true,
  hooks: {
    // Hash automático antes de crear o actualizar
    beforeCreate: async (usuario) => {
      if (usuario.password_hash) {
        usuario.password_hash = await bcrypt.hash(usuario.password_hash, 12);
      }
    },
    beforeUpdate: async (usuario) => {
      if (usuario.changed('password_hash')) {
        usuario.password_hash = await bcrypt.hash(usuario.password_hash, 12);
      }
    },
  },
});

module.exports = Usuario;
