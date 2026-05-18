const sucursalesService = require('../services/sucursales.service');

/**
 * Controlador para la gestión de Sucursales.
 * Se encarga de procesar la petición HTTP, invocar al servicio y enviar la respuesta.
 * No debe contener lógica de base de datos directa.
 */
class SucursalesController {
  
  /**
   * GET /api/sucursales
   */
  async listarSucursales(req, res) {
    // Para asegurar compatibilidad 100%, el controlador legacy devolvía: { ok: true, sucursales }
    const sucursales = await sucursalesService.listar({ activo: true });
    
    return res.json({ 
      success: true, // Enterprise pattern
      ok: true,      // Legacy pattern (Mantenido para no romper Frontend)
      sucursales 
    });
  }

  /**
   * GET /api/sucursales/:id
   */
  async obtenerSucursal(req, res) {
    const sucursal = await sucursalesService.obtenerPorId(req.params.id);
    
    return res.json({ 
      success: true,
      ok: true, 
      sucursal 
    });
  }

  /**
   * POST /api/sucursales
   */
  async crearSucursal(req, res) {
    const sucursal = await sucursalesService.crear(req.body);
    
    return res.status(201).json({ 
      success: true,
      ok: true, 
      sucursal 
    });
  }

  /**
   * PUT /api/sucursales/:id
   */
  async actualizarSucursal(req, res) {
    const sucursal = await sucursalesService.actualizar(req.params.id, req.body);
    
    return res.json({ 
      success: true,
      ok: true, 
      sucursal 
    });
  }
}

module.exports = new SucursalesController();
