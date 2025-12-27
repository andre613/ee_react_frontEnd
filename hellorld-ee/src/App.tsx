import { useState } from 'react';

import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';

interface ApiResponse {
	success: boolean;
	message: string;
	data?: unknown;
}

const App : React.FC  = () => {
	const [loading, setLoading] = useState(false);
	const [response, setResponse] = useState<ApiResponse | null>(null);
	const [error, setError] = useState<string | null>(null);

	const handleHelloWorldButtonClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
		event?.preventDefault();

		const lua = `
			local planet = Planet():setPosition(0, 0)
			planet:setPlanetRadius(3000)
			planet:setDistanceFromMovementPlane(-2000)

			planet:setPlanetSurfaceTexture("planets/planet-1.png")
			planet:setPlanetAtmosphereTexture("planets/atmosphere.png")
			planet:setPlanetAtmosphereColor(0.2, 0.2, 1.0)
			planet:setDescription("A habitable planet with breathable atmosphere")
			planet:setCallSign("Planet Alpha")
		`;

		setLoading(true);
		setError(null);
		setResponse(null);

		try {
			const res = await fetch('/api', {
				method: 'POST',
				headers: {
					'Content-Type': 'text/plain'
				},
				body: lua
			});

			if(!res.ok){
				throw new Error(`HTTP error! status: ${res.json()}`);
			}

			const data = await res.json();
			setResponse({
				success: true,
				message: 'planet created',
				data
			})
		} catch(err){
			setError(err instanceof Error ? err.message : 'An error occured.');
		} finally {
			setLoading(false);
		}
	};

  return (
    <>
      <h1>Hellorld from EE!</h1>
      <div className="card">
        <button onClick={handleHelloWorldButtonClick}>
          Hello World!
        </button>
      </div>
    </>
  )
};

export default App;