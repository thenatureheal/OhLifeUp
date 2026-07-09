const TOTAL = 22;

export default function ProductDetail() {
  return (
    <section className="bg-bg py-8 lg:py-12">
      <div className="mx-auto w-full max-w-[860px] px-0 sm:px-4">
        {Array.from({ length: TOTAL }, (_, i) => {
          const n = String(i + 1).padStart(2, "0");
          return (
            <img
              key={n}
              src={`/products/allinone/${n}.png`}
              alt={`재능·성격·건강 올인원 분석 서비스 상세 ${i + 1}`}
              loading={i < 2 ? "eager" : "lazy"}
              className="block w-full"
            />
          );
        })}
      </div>
    </section>
  );
}
