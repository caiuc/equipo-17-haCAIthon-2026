import { Route, Routes } from "react-router-dom"
import { Navbar } from "@/components/landing/Navbar"
import { Hero } from "@/components/landing/Hero"
import { Problem } from "@/components/landing/Problem"
import { Solution } from "@/components/landing/Solution"
import { HowItWorks } from "@/components/landing/HowItWorks"
import { TechNote } from "@/components/landing/TechNote"
import { FinalCta } from "@/components/landing/FinalCta"
import { Footer } from "@/components/landing/Footer"
import PassengerApp from "@/pages/PassengerApp"
import CompanyApp from "@/pages/CompanyApp"
import DriverApp from "@/pages/DriverApp"

function Landing() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Problem />
        <Solution />
        <HowItWorks />
        <TechNote />
        <FinalCta />
      </main>
      <Footer />
    </>
  )
}

// El BrowserRouter vive en main.jsx: anidar uno dentro de otro hace que React
// Router lance "You cannot render a <Router> inside another <Router>", y la app
// entera se queda en blanco. Aqui solo van las rutas.
function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<PassengerApp />} />
      <Route path="/empresa" element={<CompanyApp />} />
      <Route path="/chofer" element={<DriverApp />} />
    </Routes>
  )
}

export default App
