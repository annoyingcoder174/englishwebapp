// client/src/components/Footer.jsx

export default function Footer() {
    const year = new Date().getFullYear();

    return (
        <footer className="text-center py-4 bg-white/40 border-t border-gray-200 text-gray-600 text-[11px] leading-relaxed px-4">
            <div className="font-medium text-gray-700 text-[11px]">
                © {year} Phuc Tri Tran. All rights reserved.
            </div>

            <div className="text-[10px] text-gray-500">
                Designed, built, and maintained entirely by Phuc Tri Tran —
                frontend, backend, UI/UX, logic. No collaborators!
            </div>
        </footer>
    );
}
