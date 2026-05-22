import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "../ui/Button";

interface Props {
  cancelToken: string;
  onReset: () => void;
}

export default function ReservationSuccess({ cancelToken, onReset }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-white rounded-lg border border-gray-100 shadow-sm p-8 text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
        className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6"
      >
        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </motion.div>

      <h2 className="font-display text-2xl font-semibold mb-2">Rezervace potvrzena!</h2>
      <p className="text-gray-600 mb-6">
        Zkontrolujte e-mail – poslali jsme vám potvrzení s podrobnostmi.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link to={`/rezervace/${cancelToken}`}>
          <Button variant="secondary">Spravovat rezervaci</Button>
        </Link>
        <Button onClick={onReset}>Nová rezervace</Button>
      </div>
    </motion.div>
  );
}
