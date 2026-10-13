export type PageProps = {
	height: number;
	query: string;
	searching: boolean;
	active: boolean;
	onMessage: (message: string) => void;
};
