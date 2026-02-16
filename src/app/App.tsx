import { AppProviders } from "./providers/AppProviders";
import { AppRouter } from "./router/AppRouter";

const App = () => {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
};

export default App;
