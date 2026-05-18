const authService = require('../services/auth.service');

class AuthController {
  
  /**
   * Login interno para admin, encargado y empleado
   */
  async loginInterno(req, res) {
    const { email, password } = req.body;
    
    // Solo roles internos
    const rolesPermitidos = ['admin_superior', 'encargado_sucursal', 'empleado'];
    const usuario = await authService.validarCredenciales(email, password, rolesPermitidos);
    
    const tokens = authService.generarTokens(usuario);
    await authService.guardarRefreshToken(usuario, tokens.refreshToken);

    return res.json({
      success: true,
      ok: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      usuario: usuario.toJSON(),
    });
  }

  /**
   * Login exclusivo para repartidor
   */
  async loginRepartidor(req, res) {
    const { email, password } = req.body;
    
    const usuario = await authService.validarCredenciales(email, password, ['repartidor']);
    
    const tokens = authService.generarTokens(usuario);
    await authService.guardarRefreshToken(usuario, tokens.refreshToken);

    return res.json({
      success: true,
      ok: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      usuario: usuario.toJSON(),
    });
  }

  /**
   * Login exclusivo para clientes (usuario final)
   */
  async loginUsuario(req, res) {
    const { email, password } = req.body;
    
    const usuario = await authService.validarCredenciales(email, password, ['usuario']);
    
    const tokens = authService.generarTokens(usuario);
    await authService.guardarRefreshToken(usuario, tokens.refreshToken);

    return res.json({
      success: true,
      ok: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      usuario: usuario.toJSON(),
    });
  }

  /**
   * Refresca el access token
   */
  async refresh(req, res) {
    const { refreshToken } = req.body;
    
    // AuthService se encarga de validar expiración, DB y el chequeo hash/plano legacy
    const data = await authService.refrescarToken(refreshToken);

    return res.json({
      success: true,
      ok: true,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      // Devolvemos el usuario si es necesario para el frontend, aunque el anterior devolvía {ok, accessToken, refreshToken}
    });
  }

  /**
   * Logout (Invalida el refresh token)
   */
  async logout(req, res) {
    await authService.cerrarSesion(req.usuario.id);
    
    return res.json({
      success: true,
      ok: true,
      mensaje: 'Sesión cerrada',
    });
  }
}

module.exports = new AuthController();