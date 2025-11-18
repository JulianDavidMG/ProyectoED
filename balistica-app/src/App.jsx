import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Target } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const Balistica = () => {
  // Configuraciones de gravedad
  const gravityOptions = {
    tierra: { name: 'Tierra', g: 9.8, emoji: '🌍' },
    luna: { name: 'Luna', g: 1.6, emoji: '🌙' },
    jupiter: { name: 'Júpiter', g: 24.8, emoji: '🌕' }
  };

  // Configuraciones de medio (resistencia)
  const mediumOptions = {
    vacio: { name: 'Vacío', k_linear: 0, k_quadratic: 0, filter: 'none' },
    aire: { name: 'Aire Normal', k_linear: 0.02, k_quadratic: 0.001, filter: 'none' },
    viento: { name: 'Viento Fuerte', k_linear: 0.08, k_quadratic: 0.003, filter: 'grayscale(0.3) brightness(0.9)' },
    agua: { name: 'Agua', k_linear: 5.0, k_quadratic: 0.5, filter: 'sepia(0.3) hue-rotate(180deg) saturate(1.5)' },
    aceite: { name: 'Aceite', k_linear: 8.0, k_quadratic: 0.8, filter: 'sepia(0.6) hue-rotate(20deg) saturate(1.2)' }
  };

  // Estados de parámetros
  const [mass, setMass] = useState(0.3);
  const [v0, setV0] = useState(50);
  const [angle, setAngle] = useState(45);
  const [selectedGravity, setSelectedGravity] = useState('tierra');
  const [selectedMedium, setSelectedMedium] = useState('aire');
  const [resistanceModel, setResistanceModel] = useState('linear'); // 'linear' o 'quadratic'
  const [gravity, setGravity] = useState(9.8);
  const [k, setK] = useState(0.02);

  const [targetX, setTargetX] = useState(50);
  const [targetY, setTargetY] = useState(0);
  
  // Estado para zoom de la interfaz
  const [zoomLevel, setZoomLevel] = useState(1);

  // Estados de simulación
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [trajectoryData, setTrajectoryData] = useState([]);
  const [currentData, setCurrentData] = useState({
    t: 0, x: 0, y: 0, vx: 0, vy: 0, speed: 0
  });
  const [hitTarget, setHitTarget] = useState(false);
  
  // Estados para verificación de velocidad terminal
  const [userTerminalVelocity, setUserTerminalVelocity] = useState('');
  const [calculatedTerminalVelocity, setCalculatedTerminalVelocity] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
  const [showTerminalTheory, setShowTerminalTheory] = useState(false);

  const animationRef = useRef(null);
  const stateRef = useRef({
    t: 0, x: 0, y: 0, vx: 0, vy: 0
  });

  // Función para obtener el coeficiente k según el modelo seleccionado
  const getKValue = () => {
    const medium = mediumOptions[selectedMedium];
    return resistanceModel === 'linear' ? medium.k_linear : medium.k_quadratic;
  };

  // Función para obtener el fondo según la gravedad
  const getBackground = () => {
    switch(selectedGravity) {
      case 'luna':
        return 'bg-gradient-to-b from-black via-gray-900 to-gray-800';
      case 'jupiter':
        return 'bg-gradient-to-b from-purple-900 via-orange-900 to-orange-800';
      default: // tierra
        return 'bg-gradient-to-b from-sky-400 to-sky-200';
    }
  };

  // Función para obtener el suelo según la gravedad
  const getGround = () => {
    switch(selectedGravity) {
      case 'luna':
        return 'bg-gradient-to-t from-gray-600 to-gray-500';
      case 'jupiter':
        return 'bg-gradient-to-t from-orange-700 to-orange-500';
      default: // tierra
        return 'bg-gradient-to-t from-green-800 to-green-600';
    }
  };

  // Función para obtener estrellas si es espacio
  const isSpace = () => selectedGravity === 'luna' || selectedGravity === 'jupiter';

  // Cambiar gravedad
  const handleGravityChange = (gravityKey) => {
    setSelectedGravity(gravityKey);
    setGravity(gravityOptions[gravityKey].g);
    handleReset();
  };

  // Cambiar medio
  const handleMediumChange = (mediumKey) => {
    setSelectedMedium(mediumKey);
    setK(getKValue());
    setVerificationResult(null);
    setUserTerminalVelocity('');
    handleReset();
  };

  // Cambiar modelo de resistencia
  const handleModelChange = (model) => {
    setResistanceModel(model);
    setK(getKValue());
    setVerificationResult(null);
    setUserTerminalVelocity('');
    handleReset();
  };

  // Calcular velocidad terminal teórica
  const calculateTerminalVelocity = () => {
    const currentK = getKValue();
    
    if (currentK === 0) {
      return null; // No hay velocidad terminal en el vacío
    }
    
    if (resistanceModel === 'linear') {
      // Modelo de resistencia lineal: v_t = (m * g) / k
      const vt = (mass * gravity) / currentK;
      return vt;
    } else {
      // Modelo de resistencia cuadrática: v_t = sqrt((m * g) / k)
      const vt = Math.sqrt((mass * gravity) / currentK);
      return vt;
    }
  };

  // Verificar velocidad terminal ingresada por el usuario
  const handleVerifyTerminalVelocity = () => {
    const theoretical = calculateTerminalVelocity();
    
    if (theoretical === null) {
      setVerificationResult({
        type: 'info',
        message: 'En el vacío (k=0) no existe velocidad terminal. El proyectil acelera indefinidamente bajo la gravedad.'
      });
      setCalculatedTerminalVelocity(null);
      return;
    }
    
    setCalculatedTerminalVelocity(theoretical);
    
    const userValue = parseFloat(userTerminalVelocity);
    
    if (isNaN(userValue)) {
      setVerificationResult({
        type: 'error',
        message: 'Por favor ingresa un valor numérico válido.'
      });
      return;
    }
    
    // Tolerancia del 3%
    const tolerance = theoretical * 0.03;
    const difference = Math.abs(userValue - theoretical);
    const percentError = (difference / theoretical) * 100;
    
    if (difference <= tolerance) {
      setVerificationResult({
        type: 'success',
        message: `¡Correcto! Tu cálculo está dentro del margen de error aceptable (±3%).`,
        theoretical: theoretical,
        userValue: userValue,
        error: percentError
      });
    } else {
      setVerificationResult({
        type: 'error',
        message: `Incorrecto. El error es del ${percentError.toFixed(2)}%. Revisa tu cálculo usando la fórmula del modelo ${resistanceModel === 'linear' ? 'lineal' : 'cuadrático'}.`,
        theoretical: theoretical,
        userValue: userValue,
        error: percentError
      });
    }
  };

  // Resolver ecuaciones diferenciales usando método de Runge-Kutta 4 (RK4)
  const updatePhysics = (state, dt, m, g, k_val) => {
    const { x, y, vx, vy } = state;
    
    // Función para calcular las derivadas según el modelo
    const derivatives = (vx_curr, vy_curr) => {
      const speed = Math.sqrt(vx_curr ** 2 + vy_curr ** 2);
      
      let dvx_dt, dvy_dt;
      
      if (resistanceModel === 'linear') {
        // Modelo lineal: F_res = -k * v
        dvx_dt = -(k_val / m) * vx_curr;
        dvy_dt = -g - (k_val / m) * vy_curr;
      } else {
        // Modelo cuadrático: F_res = -k * v^2 * (v/|v|)
        // Para el componente x: -k * vx * |v|
        // Para el componente y: -g - k * vy * |v|
        dvx_dt = -(k_val / m) * vx_curr * speed;
        dvy_dt = -g - (k_val / m) * vy_curr * speed;
      }
      
      return { dvx: dvx_dt, dvy: dvy_dt, dx: vx_curr, dy: vy_curr };
    };

    // RK4: Método de Runge-Kutta de cuarto orden para mayor precisión
    // k1
    const k1 = derivatives(vx, vy);
    
    // k2
    const vx_k2 = vx + 0.5 * dt * k1.dvx;
    const vy_k2 = vy + 0.5 * dt * k1.dvy;
    const k2 = derivatives(vx_k2, vy_k2);
    
    // k3
    const vx_k3 = vx + 0.5 * dt * k2.dvx;
    const vy_k3 = vy + 0.5 * dt * k2.dvy;
    const k3 = derivatives(vx_k3, vy_k3);
    
    // k4
    const vx_k4 = vx + dt * k3.dvx;
    const vy_k4 = vy + dt * k3.dvy;
    const k4 = derivatives(vx_k4, vy_k4);
    
    // Combinar los resultados con ponderación RK4
    const new_vx = vx + (dt / 6) * (k1.dvx + 2*k2.dvx + 2*k3.dvx + k4.dvx);
    const new_vy = vy + (dt / 6) * (k1.dvy + 2*k2.dvy + 2*k3.dvy + k4.dvy);
    const new_x = x + (dt / 6) * (k1.dx + 2*k2.dx + 2*k3.dx + k4.dx);
    const new_y = y + (dt / 6) * (k1.dy + 2*k2.dy + 2*k3.dy + k4.dy);

    return {
      vx: new_vx,
      vy: new_vy,
      x: new_x,
      y: new_y
    };
  };

  // Iniciar simulación
  const handleStart = () => {
    setIsRunning(true);
    setIsPaused(false);
    setHitTarget(false);
    
    // Condiciones iniciales - proyectil inicia en (0,0)
    const angleRad = (angle * Math.PI) / 180;
    stateRef.current = {
      t: 0,
      x: 0,
      y: 0,
      vx: v0 * Math.cos(angleRad),
      vy: v0 * Math.sin(angleRad)
    };
    
    setTrajectoryData([]);
    simulate();
  };

  // Pausa/Reanudar
  const handlePause = () => {
    setIsPaused(!isPaused);
  };

  // Reiniciar
  const handleReset = () => {
    setIsRunning(false);
    setIsPaused(false);
    setHitTarget(false);
    setTrajectoryData([]);
    setCurrentData({ t: 0, x: 0, y: 0, vx: 0, vy: 0, speed: 0 });
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  };

  // Función principal de simulación
  const simulate = () => {
    const dt = 0.01; // Paso de tiempo reducido para mayor precisión (10ms)
    
    const step = () => {
      if (!isPaused) {
        const state = stateRef.current;
        
        // Actualizar física
        const newState = updatePhysics(state, dt, mass, gravity, k);
        newState.t = state.t + dt;

        //Verificar impacto con el blanco DURANTE EL VUELO (antes de tocar suelo)
      const distance = Math.sqrt(
        Math.pow(newState.x - targetX, 2) + 
        Math.pow(newState.y - targetY, 2)
      );
      
      // Si impacta el blanco (radio de 3m)
      if (distance < 3) {
        stateRef.current = newState;
        setIsRunning(false);
        setHitTarget(true);
        
        // Calcular velocidad final
        const speed = Math.sqrt(newState.vx ** 2 + newState.vy ** 2);
        setCurrentData({
          t: newState.t,
          x: newState.x,
          y: newState.y,
          vx: newState.vx,
          vy: newState.vy,
          speed: speed
        });
        
        // Agregar punto final a la trayectoria
        setTrajectoryData(prev => [...prev, {
          x: newState.x,
          y: newState.y,
          t: newState.t,
          vx: newState.vx,
          vy: newState.vy
        }]);
        
        return; // Detener inmediatamente
      }
        
        // Verificar si toca el suelo
        if (newState.y < 0) {
          newState.y = 0;
          setIsRunning(false);
          
          // Verificar impacto con el blanco - diana más pequeña con radio de 3m
          const distance = Math.sqrt(
            Math.pow(newState.x - targetX, 2) + 
            Math.pow(newState.y - targetY, 2)
          );
          if (distance < 3) { // Radio de 3 metros para la diana
            setHitTarget(true);
          }
          return;
        }
        
        stateRef.current = newState;
        
        // Calcular velocidad total
        const speed = Math.sqrt(newState.vx ** 2 + newState.vy ** 2);
        
        // Actualizar datos actuales
        setCurrentData({
          t: newState.t,
          x: newState.x,
          y: newState.y,
          vx: newState.vx,
          vy: newState.vy,
          speed: speed
        });
        
        // Agregar punto a la trayectoria (cada 3 frames para rendimiento)
        if (Math.floor(newState.t * 100) % 3 === 0) {
          setTrajectoryData(prev => [...prev, {
            x: newState.x,
            y: newState.y,
            t: newState.t,
            vx: newState.vx,
            vy: newState.vy 
          }]);
        }
      }
      
      animationRef.current = requestAnimationFrame(step);
    };
    
    animationRef.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setK(getKValue());
  }, [resistanceModel, selectedMedium]);

  useEffect(() => {
    if (isRunning && !isPaused) {
      simulate();
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  }, [isPaused]);

  return (
    <div className={`min-h-screen ${getBackground()} p-4`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white/90 backdrop-blur rounded-lg shadow-lg p-6 mb-4">
          <h1 className="text-4xl font-bold text-gray-800 mb-2 flex items-center gap-2">
            🏹 Balística
          </h1>
          <p className="text-gray-600">Simulador de movimiento de proyectiles con resistencia del aire</p>
          <div className="mt-2 flex items-center gap-2">
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Panel de Control */}
          <div className="lg:col-span-1 bg-white/90 backdrop-blur rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">⚙️ Parámetros</h2>
            
            {/* Selección de Modelo de Resistencia */}
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">📊 Modelo de Resistencia</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleModelChange('linear')}
                  disabled={isRunning}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    resistanceModel === 'linear'
                      ? 'border-blue-500 bg-blue-50 shadow-lg'
                      : 'border-gray-300 bg-white hover:border-blue-300'
                  } ${isRunning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="text-lg mb-1">📈</div>
                  <div className="text-xs font-bold">Lineal</div>
                  <div className="text-xs text-gray-600">F ∝ v</div>
                </button>
                <button
                  onClick={() => handleModelChange('quadratic')}
                  disabled={isRunning}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    resistanceModel === 'quadratic'
                      ? 'border-blue-500 bg-blue-50 shadow-lg'
                      : 'border-gray-300 bg-white hover:border-blue-300'
                  } ${isRunning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="text-lg mb-1">📉</div>
                  <div className="text-xs font-bold">Cuadrático</div>
                  <div className="text-xs text-gray-600">F ∝ v²</div>
                </button>
              </div>
            </div>
            
            {/* Selección de Gravedad */}
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">🌍 Planeta (Gravedad)</label>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(gravityOptions).map(([key, val]) => (
                  <button
                    key={key}
                    onClick={() => handleGravityChange(key)}
                    disabled={isRunning}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedGravity === key
                        ? 'border-blue-500 bg-blue-50 shadow-lg'
                        : 'border-gray-300 bg-white hover:border-blue-300'
                    } ${isRunning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className="text-2xl mb-1">{val.emoji}</div>
                    <div className="text-xs font-bold">{val.name}</div>
                    <div className="text-xs text-gray-600">{val.g} m/s²</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Selección de Medio */}
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">💨 Medio (Resistencia)</label>
              <select 
                value={selectedMedium}
                onChange={(e) => handleMediumChange(e.target.value)}
                className="w-full p-2 border-2 border-gray-300 rounded-lg"
                disabled={isRunning}
              >
                {Object.entries(mediumOptions).map(([key, val]) => (
                  <option key={key} value={key}>
                    {val.name} (k = {resistanceModel === 'linear' ? val.k_linear : val.k_quadratic} {resistanceModel === 'linear' ? 's⁻¹' : 'kg/m'})
                  </option>
                ))}
              </select>
            </div>

            {/* Parámetros de la Flecha */}
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-1">Masa (kg): {mass.toFixed(2)}</label>
              <input 
                type="range" 
                min="0.1" 
                max="5" 
                step="0.1" 
                value={mass}
                onChange={(e) => setMass(parseFloat(e.target.value))}
                className="w-full"
                disabled={isRunning}
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold mb-1">Velocidad Inicial (m/s): {v0.toFixed(0)}</label>
              <input 
                type="range" 
                min="10" 
                max="150" 
                step="1" 
                value={v0}
                onChange={(e) => setV0(parseFloat(e.target.value))}
                className="w-full"
                disabled={isRunning}
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold mb-1">Ángulo (°): {angle.toFixed(0)}</label>
              <input 
                type="range" 
                min="0" 
                max="90" 
                step="1" 
                value={angle}
                onChange={(e) => setAngle(parseFloat(e.target.value))}
                className="w-full"
                disabled={isRunning}
              />
            </div>

            {/* Configuración del Blanco */}
            <div className="mb-4 border-t pt-4">
              <h3 className="font-bold mb-2 flex items-center gap-1">
                <Target size={18} /> Blanco
              </h3>
              <label className="block text-sm font-semibold mb-1">Distancia X (m): {targetX.toFixed(0)}</label>
              <input 
                type="range" 
                min="10" 
                max="100" 
                step="2" 
                value={targetX}
                onChange={(e) => setTargetX(parseFloat(e.target.value))}
                className="w-full"
                disabled={isRunning}
              />
              
              <label className="block text-sm font-semibold mb-1 mt-2">Altura Y (m): {targetY.toFixed(0)}</label>
              <input 
                type="range" 
                min="0" 
                max="30" 
                step="1" 
                value={targetY}
                onChange={(e) => setTargetY(parseFloat(e.target.value))}
                className="w-full"
                disabled={isRunning}
              />
            </div>

            {/* Controles */}
            <div className="flex gap-2 mt-6">
              <button 
                onClick={handleStart}
                disabled={isRunning}
                className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded flex items-center justify-center gap-2"
              >
                <Play size={20} /> Disparar
              </button>
              <button 
                onClick={handlePause}
                disabled={!isRunning}
                className="flex-1 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded flex items-center justify-center gap-2"
              >
                <Pause size={20} /> {isPaused ? 'Reanudar' : 'Pausa'}
              </button>
              <button 
                onClick={handleReset}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-4 rounded flex items-center justify-center gap-2"
              >
                <RotateCcw size={20} /> Reiniciar
              </button>
            </div>

            {/* Resultado */}
            {hitTarget && (
              <div className="mt-4 bg-green-100 border-2 border-green-500 rounded p-3 text-center">
                <p className="text-green-800 font-bold text-lg">🎯 ¡IMPACTO EXITOSO!</p>
              </div>
            )}
            {isRunning === false && trajectoryData.length > 0 && !hitTarget && (
              <div className="mt-4 bg-red-100 border-2 border-red-500 rounded p-3 text-center">
                <p className="text-red-800 font-bold">❌ Falló el blanco</p>
              </div>
            )}

            {/* Verificación de Velocidad Terminal */}
            <div className="mt-6 border-t pt-4">
              <div className="bg-purple-50 p-4 rounded-lg border-2 border-purple-200">
                <p className="text-sm text-gray-700 mb-3">
                  <strong>Velocidad Terminal - Modelo {resistanceModel === 'linear' ? 'Lineal' : 'Cuadrático'}:</strong>
                </p>
                
                <div className="grid grid-cols-3 gap-2 mb-3 text-sm bg-white p-2 rounded">
                  <div>
                    <p className="text-xs text-gray-600">Masa (m)</p>
                    <p className="font-bold">{mass.toFixed(2)} kg</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Gravedad (g)</p>
                    <p className="font-bold">{gravity.toFixed(1)} m/s²</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Coef. k</p>
                    <p className="font-bold">{k.toFixed(3)} {resistanceModel === 'linear' ? 's⁻¹' : 'kg/m'}</p>
                  </div>
                </div>

                <label className="block text-sm font-semibold mb-2">Tu cálculo de v_terminal (m/s):</label>
                <input
                  type="number"
                  step="0.01"
                  value={userTerminalVelocity}
                  onChange={(e) => setUserTerminalVelocity(e.target.value)}
                  placeholder="Ingresa tu resultado"
                  className="w-full p-2 border-2 border-purple-300 rounded-lg mb-3"
                />
                
                <button
                  onClick={handleVerifyTerminalVelocity}
                  className="w-full bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded transition-colors"
                >
                  ✓ Verificar Cálculo
                </button>

                {/* Resultado de verificación */}
                {verificationResult && (
                  <div className={`mt-3 p-3 rounded-lg border-2 ${
                    verificationResult.type === 'success' 
                      ? 'bg-green-50 border-green-500' 
                      : verificationResult.type === 'error'
                      ? 'bg-red-50 border-red-500'
                      : 'bg-blue-50 border-blue-500'
                  }`}>
                    <p className={`font-bold mb-2 ${
                      verificationResult.type === 'success' 
                        ? 'text-green-800' 
                        : verificationResult.type === 'error'
                        ? 'text-red-800'
                        : 'text-blue-800'
                    }`}>
                      {verificationResult.type === 'success' ? '✅ ' : verificationResult.type === 'error' ? '❌ ' : 'ℹ️ '}
                      {verificationResult.message}
                    </p>
                    
                    {verificationResult.theoretical !== undefined && (
                      <div className="text-sm space-y-1 mt-2 bg-white p-2 rounded">
                        <p><strong>Tu respuesta:</strong> {verificationResult.userValue.toFixed(3)} m/s</p>
                        <p><strong>Valor teórico:</strong> {verificationResult.theoretical.toFixed(3)} m/s</p>
                        <p><strong>Diferencia:</strong> {Math.abs(verificationResult.userValue - verificationResult.theoretical).toFixed(3)} m/s ({verificationResult.error.toFixed(2)}%)</p>
                        <div className="mt-2 pt-2 border-t">
                          {resistanceModel === 'linear' ? (
                            <>
                              <p className="font-mono text-xs">v_t = ({mass} × {gravity}) / {k}</p>
                              <p className="font-mono text-xs">v_t = {(mass * gravity).toFixed(3)} / {k}</p>
                            </>
                          ) : (
                            <>
                              <p className="font-mono text-xs">v_t = √(({mass} × {gravity}) / {k})</p>
                              <p className="font-mono text-xs">v_t = √({(mass * gravity).toFixed(3)} / {k})</p>
                              <p className="font-mono text-xs">v_t = √({(mass * gravity / k).toFixed(3)})</p>
                            </>
                          )}
                          <p className="font-mono text-xs font-bold text-purple-700">v_t = {verificationResult.theoretical.toFixed(3)} m/s</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Resto del código permanece igual */}
          {/* Panel de Visualización */}
          <div className="lg:col-span-2 space-y-4">
            {/* Datos en Tiempo Real */}
            <div className="bg-white/90 backdrop-blur rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">📊 Datos en Tiempo Real</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 p-3 rounded">
                  <p className="text-xs text-gray-600 font-semibold">Tiempo (s)</p>
                  <p className="text-2xl font-bold text-blue-600">{currentData.t.toFixed(2)}</p>
                </div>
                <div className="bg-green-50 p-3 rounded">
                  <p className="text-xs text-gray-600 font-semibold">Posición X (m)</p>
                  <p className="text-2xl font-bold text-green-600">{currentData.x.toFixed(1)}</p>
                </div>
                <div className="bg-purple-50 p-3 rounded">
                  <p className="text-xs text-gray-600 font-semibold">Posición Y (m)</p>
                  <p className="text-2xl font-bold text-purple-600">{currentData.y.toFixed(1)}</p>
                </div>
                <div className="bg-orange-50 p-3 rounded">
                  <p className="text-xs text-gray-600 font-semibold">Velocidad X (m/s)</p>
                  <p className="text-2xl font-bold text-orange-600">{currentData.vx.toFixed(1)}</p>
                </div>
                <div className="bg-red-50 p-3 rounded">
                  <p className="text-xs text-gray-600 font-semibold">Velocidad Y (m/s)</p>
                  <p className="text-2xl font-bold text-red-600">{currentData.vy.toFixed(1)}</p>
                </div>
                <div className="bg-indigo-50 p-3 rounded">
                  <p className="text-xs text-gray-600 font-semibold">Rapidez (m/s)</p>
                  <p className="text-2xl font-bold text-indigo-600">{currentData.speed.toFixed(1)}</p>
                </div>
              </div>
            </div>

            {/* Visualización del Campo de Tiro */}
            <div className="bg-white/90 backdrop-blur rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4 text-gray-800">⁀➴ Campo de Tiro</h3>
              <div 
                className={`relative w-full h-96 ${getBackground()} rounded-lg border-4 border-gray-700 overflow-hidden`}
                style={{ filter: mediumOptions[selectedMedium].filter }}
              >
                {/* Estrellas para espacio */}
                {isSpace() && (
                  <div className="absolute inset-0">
                    {[...Array(50)].map((_, i) => (
                      <div
                        key={i}
                        className="absolute w-1 h-1 bg-white rounded-full"
                        style={{
                          left: `${Math.random() * 100}%`,
                          top: `${Math.random() * 80}%`,
                          opacity: Math.random() * 0.8 + 0.2,
                          animation: `twinkle ${Math.random() * 3 + 2}s infinite`
                        }}
                      />
                    ))}
                  </div>
                )}
                
                {/* Rejilla de fondo para referencia de distancia */}
                <svg className="absolute inset-0 w-full h-full opacity-20">
                  {[...Array(10)].map((_, i) => (
                    <line
                      key={`v-${i}`}
                      x1={`${10 + i * 10}%`}
                      y1="0%"
                      x2={`${10 + i * 10}%`}
                      y2="100%"
                      stroke={isSpace() ? '#fff' : '#000'}
                      strokeWidth="1"
                    />
                  ))}
                  {[...Array(8)].map((_, i) => (
                    <line
                      key={`h-${i}`}
                      x1="0%"
                      y1={`${10 + i * 12}%`}
                      x2="100%"
                      y2={`${10 + i * 12}%`}
                      stroke={isSpace() ? '#fff' : '#000'}
                      strokeWidth="1"
                    />
                  ))}
                </svg>
                
                {/* Marcadores de distancia */}
                <div className={`absolute bottom-10 left-0 right-0 flex justify-around text-xs font-bold ${isSpace() ? 'text-white' : 'text-gray-700'}`}>
                  {[0, 20, 40, 60, 80, 100].map((dist) => (
                    <div key={dist} className={`${isSpace() ? 'bg-black/60' : 'bg-white/80'} px-1 rounded`}>{dist}m</div>
                  ))}
                </div>
                
                {/* Suelo */}
                <div className={`absolute bottom-0 w-full h-10 ${getGround()}`}>
                  {selectedGravity === 'luna' && (
                    <div className="absolute inset-0 flex items-center justify-around text-gray-400 text-xs">
                      {[...Array(8)].map((_, i) => (
                        <div key={i} className="w-3 h-3 bg-gray-500 rounded-full opacity-50" />
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Arquero*/}
                <div className="absolute bottom-10 left-8">
                  <div className="text-2xl">🏹</div>
                  <div className="text-sm text-center font-bold bg-white/80 rounded px-1">INICIO</div>
                </div>
                
                {/* Blanco */}
                <div 
                  className="absolute transition-all duration-300"
                  style={{
                    left: `${Math.min(92, (targetX / 100) * 85 + 10)}%`,
                    bottom: `${(targetY / 50) * 70 + 40}px`,
                    transform: 'translate(-50%, 50%)'
                  }}
                >
                  <div className="relative">
                    <div className="relative">
                      {/* Diana con anillos */}
                      <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
                            <div className="w-4 h-4 rounded-full bg-yellow-400"></div>
                          </div>
                        </div>
                      </div>
                      <Target className="absolute inset-0 text-gray-800 opacity-30" size={64} />
                    </div>
                    <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-sm font-bold whitespace-nowrap bg-white/90 px-2 py-1 rounded shadow">
                      🎯 {targetX}m, {targetY}m
                    </div>
                  </div>
                </div>
                
                {/* Trayectoria completa */}
                {trajectoryData.length > 1 && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    <defs>
                      <linearGradient id="trajectoryGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" style={{ stopColor: '#8b5cf6', stopOpacity: 0.4 }} />
                        <stop offset="100%" style={{ stopColor: '#8b5cf6', stopOpacity: 1 }} />
                      </linearGradient>
                    </defs>
                    <path
                      d={trajectoryData.map((point, i) => {
                        const x = (point.x / 100) * 85 + 10;
                        const y = 100 - ((point.y / 50) * 75 + 10);
                        return `${i === 0 ? 'M' : 'L'} ${x}% ${y}%`;
                      }).join(' ')}
                      fill="none"
                      stroke="url(#trajectoryGradient)"
                      strokeWidth="2"
                      opacity="0.5"
                    />
                    {/* Puntos a lo largo de la trayectoria */}
                    {trajectoryData.filter((_, i) => i % 3 === 0).map((point, i) => {
                      const x = (point.x / 100) * 85 + 10;
                      const y = 100 - ((point.y / 50) * 75 + 10);
                      return (
                        <circle
                          key={i}
                          cx={`${x}%`}
                          cy={`${y}%`}
                          r="3"
                          fill="#8b5cf6"
                          opacity="0.6"
                        />
                      );
                    })}
                  </svg>
                )}
                
                {/* Punto actual en movimiento (ROJO) */}
                {isRunning && currentData.y >= 0 && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    <circle
                      cx={`${Math.min(92, (currentData.x / 100) * 85 + 10)}%`}
                      cy={`${100 - ((currentData.y / 50) * 75 + 10)}%`}
                      r="6"
                      fill="#ef4444"
                      stroke="#fff"
                      strokeWidth="2"
                    >
                      <animate attributeName="r" values="6;8;6" dur="1s" repeatCount="indefinite" />
                    </circle>
                  </svg>
                )}
                
                {/* Indicador de impacto*/}
                {hitTarget && (
                  <div
                    className="absolute"
                    style={{
                      left: `${Math.min(92, (targetX / 100) * 85 + 10)}%`,
                      bottom: `${(targetY / 50) * 70 + 40}px`,
                      transform: 'translate(-50%, 50%)'
                    }}
                  >
                    <div className="text-2xl animate-ping">💥</div>
                    <div className="text-2xl absolute inset-0">⭐</div>
                  </div>
                )}
              </div>
            </div>
          
          
          {/* Gráfico de Altura vs Tiempo */}
          <div className="bg-white/90 backdrop-blur rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-bold mb-4 text-gray-800">Altura vs Tiempo</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trajectoryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="t" 
                  label={{ value: 'Tiempo (s)', position: 'insideBottom', offset: -5 }} 
                  tickFormatter={(value) => value.toFixed(2)}
                />
                <YAxis 
                  label={{ value: 'Altura Y (m)', angle: -90, position: 'insideLeft' }} 
                  tickFormatter={(value) => value.toFixed(2)}
                />
                <Tooltip 
                  formatter={(value) => [Number(value).toFixed(2) + ' m', 'Altura']}
                  labelFormatter={(value) => `Tiempo: ${Number(value).toFixed(2)} s`}
                />
                <Line type="monotone" dataKey="y" stroke="#10b981" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Gráfico de Alcance vs Tiempo */}
          <div className="bg-white/90 backdrop-blur rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-bold mb-4 text-gray-800">Alcance vs Tiempo</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trajectoryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="t" 
                  label={{ value: 'Tiempo (s)', position: 'insideBottom', offset: -5 }} 
                  tickFormatter={(value) => value.toFixed(2)}
                />
                <YAxis 
                  label={{ value: 'Alcance X (m)', angle: -90, position: 'insideLeft' }} 
                  tickFormatter={(value) => value.toFixed(2)}
                />
                <Tooltip 
                  formatter={(value) => [Number(value).toFixed(2) + ' m', 'Alcance']} 
                  labelFormatter={(value) => `Tiempo: ${Number(value).toFixed(2)} s`}
                />
                <Line type="monotone" dataKey="x" stroke="#3b82f6" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>  

         {/* Gráfica de Componentes de Velocidad vs Tiempo */}
<div className="bg-white/90 backdrop-blur rounded-lg shadow-lg p-4">
  <h3 className="text-lg font-bold mb-3 text-gray-800">Componentes de Velocidad vs Tiempo</h3>
  <ResponsiveContainer width="100%" height={200}>
    <LineChart data={trajectoryData}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis 
        dataKey="t" 
        label={{ value: 'Tiempo (s)', position: 'insideBottom', offset: -5 }} 
        tickFormatter={(value) => value.toFixed(2)}
      />
      <YAxis 
        label={{ value: 'Velocidad (m/s)', angle: -90, position: 'insideLeft' }} 
        tickFormatter={(value) => value.toFixed(1)}
      />
      <Tooltip 
        formatter={(value, name) => {
          const labels = {
            'vx': 'Velocidad X',
            'vy': 'Velocidad Y'
          };
          return [Number(value).toFixed(2) + ' m/s', labels[name] || name];
        }}
        labelFormatter={(value) => `Tiempo: ${Number(value).toFixed(2)} s`}
      />
      <Legend />
      <Line 
        type="monotone" 
        dataKey="vx" 
        stroke="#3b82f6" 
        dot={false} 
        strokeWidth={2} 
        name="Velocidad X"
      />
      <Line 
        type="monotone" 
        dataKey="vy" 
        stroke="#ef4444" 
        dot={false} 
        strokeWidth={2} 
        name="Velocidad Y"
      />
    </LineChart>
  </ResponsiveContainer>
</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Balistica;

// Estilos CSS para la animación de estrellas
const style = document.createElement('style');
style.textContent = `
  @keyframes twinkle {
    0%, 100% { opacity: 0.2; }
    50% { opacity: 1; }
  }
`;
document.head.appendChild(style);