"use client";

import { useRef } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatNaira } from "@/lib/format";
import { fx, gsap, isReducedMotion, refreshTriggers, useGSAP } from "@/lib/gsap/effects";

const WEEKS = [3380, 3420, 3400, 3470, 3510, 3490, 3560, 3540].map((price, index) => ({
  week: `Wk ${index + 1}`,
  price,
}));

const AXIS_TICK = { fill: "#6B7B73", fontSize: 13, fontFamily: "var(--font-mono)" };

export default function PriceChart() {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    (_, contextSafe) => {
      const root = scope.current;
      if (!root || !contextSafe) return;

      const draw = contextSafe(() => {
        const path = root.querySelector<SVGPathElement>(".recharts-line-curve");
        if (!path) return false;

        if (isReducedMotion()) {
          fx("riseIn", path);
        } else {
          const length = path.getTotalLength();
          gsap.fromTo(
            path,
            { strokeDasharray: length, strokeDashoffset: length },
            {
              strokeDashoffset: 0,
              duration: 1.4,
              ease: "power2.inOut",
              clearProps: "strokeDasharray,strokeDashoffset",
              scrollTrigger: { trigger: root, start: "top 80%", once: true },
            },
          );
        }
        refreshTriggers();
        return true;
      });

      // Recharts draws after it has measured its container.
      if (draw()) return;
      const observer = new MutationObserver(() => {
        if (draw()) observer.disconnect();
      });
      observer.observe(root, { childList: true, subtree: true });
      return () => observer.disconnect();
    },
    { scope },
  );

  return (
    <div
      ref={scope}
      role="img"
      aria-label="Line chart of example average broiler bids near Jos over 8 weeks, rising from ₦3,380 to ₦3,540 per kg."
      className="h-full w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={WEEKS} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="#DCE3DF" strokeWidth={1} />
          <XAxis
            dataKey="week"
            axisLine={{ stroke: "#DCE3DF" }}
            tickLine={false}
            tick={AXIS_TICK}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis
            domain={[3300, 3800]}
            ticks={[3300, 3550, 3800]}
            axisLine={false}
            tickLine={false}
            width={64}
            tick={AXIS_TICK}
            tickFormatter={(value: number) => formatNaira(value)}
          />
          <Tooltip
            cursor={{ stroke: "#DCE3DF", strokeWidth: 1 }}
            formatter={(value) => [formatNaira(Number(value), "kg"), "Average bid"]}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #DCE3DF",
              boxShadow: "none",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
            }}
            labelStyle={{ color: "#6B7B73" }}
            itemStyle={{ color: "#14201B" }}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke="#1F5C45"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, stroke: "#FFFFFF", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
