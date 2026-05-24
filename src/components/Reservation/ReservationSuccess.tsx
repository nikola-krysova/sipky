import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "../ui/Button";

interface Props {
  cancelToken: string;
  reservationNumber?: number;
  onReset: () => void;
}

export default function ReservationSuccess({ cancelToken, reservationNumber, onReset }: Props) {
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
      {reservationNumber && (
        <p className="text-2xl font-mono font-semibold text-gray-700 mb-3">
          #{String(reservationNumber).padStart(4, "0")}
        </p>
      )}
      <p className="text-gray-600 mb-2">
        Zkontrolujte e-mail – poslali jsme vám potvrzení s podrobnostmi.
      </p>
      <p className="text-gray-500 text-sm mb-6">
        V e-mailu najdete odkaz pro správu nebo zrušení rezervace.
      </p>

      <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left text-sm text-gray-600">
        <p className="font-medium text-gray-700 mb-1">Kde nás najdete?</p>
        <p>Restaurace U Školy · Milešovice, okres Vyškov</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link to={`/rezervace/${cancelToken}`}>
          <Button variant="secondary">Spravovat rezervaci</Button>
        </Link>
        <Button onClick={onReset}>Nová rezervace</Button>
      </div>
    </motion.div>
  );
}
