const usuariosService = require('../services/usuarios.service');

class UsuariosController {
  
  async listarUsuarios(req, res) {
    const { rol, activo, sucursal_id, limit, offset } = req.query;
    
    // El servicio valida internamente la tenencia de sucursal basada en req.usuario
    const { total, usuarios } = await usuariosService.listar(
      req.usuario, 
      { rol, activo, sucursal_id }, 
      limit, 
      offset
    );

    return res.json({
      success: true,
      ok: true,
      total,
      usuarios
    });
  }

  async listarRoles(req, res) {
    const roles = await usuariosService.listarRoles();
    return res.json({
      success: true,
      ok: true,
      roles
    });
  }

  async crearUsuario(req, res) {
    const usuario = await usuariosService.crear(req.usuario, req.body);
    
    // Remover hash antes de enviar
    const usuarioJSON = usuario.toJSON();
    delete usuarioJSON.password_hash;

    return res.status(201).json({
      success: true,
      ok: true,
      usuario: usuarioJSON
    });
  }

  async actualizarUsuario(req, res) {
    const usuario = await usuariosService.actualizar(req.usuario, req.params.id, req.body);
    
    const usuarioJSON = usuario.toJSON();
    delete usuarioJSON.password_hash;

    return res.json({
      success: true,
      ok: true,
      usuario: usuarioJSON
    });
  }

  async eliminarUsuario(req, res) {
    await usuariosService.eliminar(req.usuario, req.params.id);
    
    return res.json({
      success: true,
      ok: true,
      mensaje: 'Usuario eliminado'
    });
  }

  async cambiarPassword(req, res) {
    const { password_actual, password_nueva } = req.body;
    await usuariosService.cambiarPassword(req.usuario, password_actual, password_nueva);

    return res.json({
      success: true,
      ok: true,
      mensaje: 'Contraseña actualizada'
    });
  }
}

module.exports = new UsuariosController();
